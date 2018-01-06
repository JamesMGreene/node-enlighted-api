'use strict';

/*
 * Sending an HTTP GET request to https://{host}/ems/services/application.wadl
 * will provide you with the WADL XML for the WHOLE web service!
 *
 * e.g. https://10.1.22.203/ems/services/application.wadl
 */

// Node.js core modules
var url = require('url');

// Userland modules
var _ = require('lodash');
var request = require('request-promise');
var rpErrors = require('request-promise/errors');
var format = require('string-template');

// Local variables
var DEFAULT_BASE_URL = '/ems/services/org/';
var REQUEST_CONVENIENCE_METHODS = [
      'get', 'post', 'put', 'patch',
      'del', 'delete', 'head', 'options'
    ];
var slicer = Array.prototype.slice;
var StatusCodeError = rpErrors.StatusCodeError;

function _args(args) {
  return slicer.call(args);
}

function reqArgs(uri, args) {
  return [uri].concat(_args(args));
}

/**
 * ???
 * @param {object} options
 * @param {string} options.origin - The origin for the hosted Enlighted Energy Manager API
 * @param {string} [options.baseUrl='/ems/services/org/'] - The base URL for the hosted Enlighted Energy Manager API
 * @param {boolean} [options.strictSSL=true] - If `true`, SSL certificates must be valid
 * @param {string} options.user - The username to be used for Basic authentication
 * @param {string} options.pass - The password to be used for Basic authentication
 * @param {boolean} [options.jsonPreferred=true] - Indicates a default preference for JSON over XML
 * @constructor
 */
function EnlightedApi(options) {
  if (!(this instanceof EnlightedApi)) {
    return new EnlightedApi(options);
  }

  var opts = options || {},
      requestDefaults = {
        headers: {
          'user-agent': 'EnlightedRestApiClient'
        }
      };

  if (!opts.origin) {
    throw new TypeError('Must provide `options.origin`');
  }
  if (!/^https?:\/\/[^\/]+/.test(opts.origin)) {
    throw new TypeError('`options.origin` must begin with a valid HTTP(S) protocol');
  }

  if (opts.baseUrl) {
    if (opts.baseUrl.slice(0, 1) !== '/') {
      opts.baseUrl = '/' + opts.baseUrl;
    }
    if (opts.baseUrl.slice(-1) !== '/') {
      opts.baseUrl += '/';
    }
  }
  else {
    opts.baseUrl = DEFAULT_BASE_URL;
  }
  requestDefaults.baseUrl = opts.origin + opts.baseUrl;

  if (opts.strictSSL === false) {
    requestDefaults.rejectUnauthorized = false;
  }

  if (!opts.user) {
    throw new TypeError('Must provide a username for Basic authentication');
  }
  if (!opts.pass) {
    throw new TypeError('Must provide a password for Basic authentication');
  }
  requestDefaults.auth = {
    user: opts.user,
    pass: opts.pass
  };

  if (opts.jsonPreferred !== false) {
    opts.jsonPreferred = true;
  }

  this.options = opts;
  this.request = request.defaults(requestDefaults);
}

_.forEach(
  REQUEST_CONVENIENCE_METHODS,
  function(httpMethod) {
    EnlightedApi.prototype[httpMethod] = function() {
      return this.request[httpMethod].apply(this, arguments);
    };
  }
);

var apiMeta = {
      'get': {
        getCompany: '/company',
        getCompanyList: '/company/list',
        getNodePath: '/facilities/nodepath/{nodeType}/{nodeId}',
        // `params.floorId` is optional
        getFloorPlan: '/floor/{floorId}',
        getCampusList: '/campus/list/{companyId}',
        getBuildingList: '/building/list/{campusId}',
        // `params.buildingId` is optional
        getFloorList: '/floor/list/{buildingId}',
        getAreaList: '/area/list/{floorId}',

      },
      'post': {
        deleteFloor: '/floor/delete/{floorId}',
        deleteCampus: '/campus/delete/{campusId}',
        deleteArea: '/area/delete/{areaId}',
        deleteBuilding: '/building/delete/{buildingId}',
        setFloorPlan: '/floor/setimage/{companyName}/{campusName}/{buildingName}/{floorName}/{imageUrl}',

      }
    };

Object.keys( apiMeta )
  .forEach(function( httpMethod ) {
    var methodNames = Object.keys( apiMeta[ httpMethod ] );
    methodNames.forEach(function( methodName ) {
      EnlightedApi.prototype[ methodName ] = function( params, options ) {
        return this[ httpMethod ](
          format( apiMeta[ httpMethod ][ methodName ], params || {} ),
          options || {}
        );
      };
    });
  });





EnlightedApi.prototype.setFloorPlan = function(params, options) {
  return this.post(
    format('/floor/setimage/{companyName}/{campusName}/{buildingName}/{floorName}/{imageUrl}', params || {}),
    options || {}
  );
};

// `params.areaId` is optional
EnlightedApi.prototype.getFloorPlanFromArea = function(params, options) {
  return this.get(
    format('/area/{areaId}', params || {}),
    options || {}
  );
};

EnlightedApi.prototype.assignFixtures = function(params, options) {
  return this.post(
    format('/area/{areaId}/assignfixtures', params || {}),
    options || {}
  );
};





EnlightedApi.prototype.adjustLights = async function (lights, lightLevel, duration) {
  var now = Date.now();
  var requestBody = {fixtures: {fixture: _.map(lights, l => _.pick(l, ['id', 'name']))}};

  var xmlBuilder = new xml2js.Builder({headless: true, renderOpts: {pretty: true, indent: '  ', newline: '\n'}});
  var requestXml = xmlBuilder.buildObject(requestBody);

  var minutes = parseInt(duration, 10) || 60;

  let requestUrl;
  if ((String(lightLevel)).toLowerCase() === 'auto') {
    requestUrl = `/services/org/fixture/op/mode/AUTO/`;
  } else {
    requestUrl = `/services/org/fixture/op/dim/abs/${lightLevel}/${minutes}/`;
  }

  // Console.log('Light adjustment XML:\n' + requestXml);

  let returnVal = {success: true};
  try {
    await this.request({
      method: 'POST',
      uri: requestUrl,
      qs: {
        ts: now
      },
      body: requestXml
    });
  } catch (err) {
    returnVal = {success: false};
  }

  return returnVal;
};

EnlightedApi.prototype.getAllLightsOnFloor = async function (floorNum) {
  var now = Date.now();
  var xml = await this.request({
    method: 'GET',
    uri: `/services/org/fixture/list/floor/${floorNum}/`,
    qs: {
      ts: now,
      transactionId: now,
      propertyType: 'floor',
      propertyMode: 'FLOORPLAN'
    }
  });

  var floorData = await parseXmlAsPromised(xml, {async: true, explicitArray: false});
  var fixtures = floorData.fixtures.fixture;
  var lights = fixtures.map(f => _.pick(f, ['id', 'name', 'lightlevel']));

  // Console.log('Light status JSON:\n' + JSON.stringify(lights));

  return lights;
};



module.exports = EnlightedApi;
