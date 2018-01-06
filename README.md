# `node-enlighted-api`

A Node.js client for the [Enlighted Energy Manager](https://www.enlightedinc.com/system-and-solutions/iot-system/energy-manager/) REST API


## Installation

```shell
$ npm install --save enlighted-api
```

## API

```js

```



## Quirks

The Enlighted Energy Manager REST API is not without its quirks.

Some things to watch out for include:

 - Commands sent to non-existent fixtures still return an HTTP status code of `200 (OK)` and a body status of `{"status": 0}` (which is the normal result for a successful operation).
 - ???


## License

Copyright (c) 2017, James M. Greene (MIT License)
