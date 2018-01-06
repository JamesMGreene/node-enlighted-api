'use strict';

module.exports = function( grunt ) {

  // Project configuration.
  grunt.initConfig({

    // Metadata.
    pkg: require( './package.json' ),

    // Task configuration.

    jshint: {
      options: {
        jshintrc: true
      },
      gruntfile: [ 'Gruntfile.js' ],
      src: [ 'index.js' ]
    }

  });


  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-contrib-jshint');

  // Default task.
  grunt.registerTask( 'default', [ 'jshint' ] );

  // Travis CI task.
  grunt.registerTask( 'travis', [ 'jshint' ] );

};
