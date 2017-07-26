(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
  define(['satellite.js'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.
    module.exports = factory(require('satellite.js'));
  } else {
    // Browser globals (root is window)
    root.returnExports = factory(root.satellite);
  }
}(this, function (satellitejs) {

const satellite = satellitejs.satellite;

// See https://en.wikipedia.org/wiki/Two-line_element_set.
const tleLines = {
  line1: {
    // TLE line number.
    lineNumber1: {
      start: 0,
      length: 1
    },

    // Satellite catalog number.
    satelliteNumber: {
      start: 2,
      length: 5
    },

    // Satellite classification (U is unclassified).
    classification: {
      start: 7,
      length: 1
    },

    // International Designator: Last 2 digits of launch year.
    intDesignatorYear: {
      start: 9,
      length: 2
    },

    // International Designator: Launch number of the year.
    intDesignatorLaunchNumber: {
      start: 11,
      length: 3
    },

    // International Designator: Piece of the launch.
    intDesignatorPieceOfLaunch: {
      start: 14,
      length: 3
    },

    // Last 2 digits of epoch year (when this TLE was generated).
    epochYear: {
      start: 18,
      length: 2
    },

    // Fractional day of the year of epoch(when this TLE was generated).
    epochDay: {
      start: 20,
      length: 12
    },

    // First Time Derivative of the Mean Motion divided by two.
    firstTimeDerivative: {
      start: 33,
      length: 11
    },

    // Second Time Derivative of Mean Motion divided by six (decimal point assumed).
    secondTimeDerivative: {
      start: 44,
      length: 8
    },

    // BSTAR drag term (decimal point assumed).
    bstarDrag: {
      start: 53,
      length: 8
    },

    // The number 0 (originally this should have been "Ephemeris type").
    numZero: {
      start: 62,
      length: 1
    },

    // TLE element set number.  Incremented for each new TLE generated.
    tleSetNumber: {
      start: 64,
      length: 4
    },

    // TLE Checksum (modulo 10).
    checksum1: {
      start: 68,
      length: 1
    },
  },

  line2: {
    // TLE line number.
    lineNumber2: {
      start: 0,
      length: 1
    },

    // Satellite catalog number.
    satelliteNumber2: {
      start: 2,
      length: 5
    },

    // Inclination in degrees.
    inclination: {
      start: 8,
      length: 8
    },

    // Right ascension of the ascending node in degrees.
    rightAscension: {
      start: 17,
      length: 8
    },

    // Orbit eccentricity, decimal point assumed.
    eccentricity: {
      start: 26,
      length: 7
    },

    // Argument of perigee in degrees.
    perigee: {
      start: 34,
      length: 8
    },

    // Mean Anomaly in degrees.
    meanAnomaly: {
      start: 43,
      length: 8
    },

    // Revolutions per day (mean motion).
    meanMotion: {
      start: 52,
      length: 11
    },

    // Total satellite revolutions when this TLE was generated.
    revNumberAtEpoch: {
      start: 63,
      length: 5
    },

    // TLE Checksum (modulo 10).
    checksum2: {
      start: 68,
      length: 1
    }
  }
}

var tle = {
  cache: {},

  init: function(){
    this.createTLEGetters();
  },

  parseTLE: function(tle) {
    // Check if already parsed.
    if (typeof tle === 'object' && tle.arr) return tle;

    let outputObj = {};
    let tleArr = [];
    const tleType = (Array.isArray(tle)) ? 'array' : typeof tle;

    switch (tleType) {
      case 'array':
        // Make a copy.
        tleArr = tle.concat();
      break;

      case 'string':
        // Convert string to array.
        tleArr = tle.split('\n');
      break;

      default:
        throw new Error(`TLE passed is invalid type ${tleType}`);
    }

    // Handle 2 and 3 line variants.
    if (tleArr.length > 2) {
      // 3-line TLE with satellite name as the first line.

      // Keep track of satellite name.
      outputObj.name = tleArr[0];

      // Remove name from array.
      tleArr.splice(0, 1);
    } else {
      // 2-line TLE with no satellite name.
      outputObj.name = 'Unknown';
    }

    // Trim spaces
    tleArr = tleArr.map(line => line.trim());

    outputObj.arr = tleArr;

    return outputObj;
  },

  isInt: function (num) {
    return typeof num === 'number' && num % 1 === 0;
  },

  isValidTLE: function(tle) {
    let isValid = true;

    const isParsedTLE = typeof tle === 'object' && tle.arr;
    const parsedTLE = this.parseTLE(tle);

    if (parsedTLE.arr.length !== 2) return false;

    // Check line numbers and checksums at the same time.
    parsedTLE.arr.forEach((line, index) => {
      // Noop if already invalid.
      if (!isValid) return;

      const lineNumber = index + 1;

      // Check line number.
      const parsedLineNumber = this[`getLineNumber${lineNumber}`](parsedTLE);
      const lineNumberIsValid = parsedLineNumber === lineNumber;

      // Checksum.
      const calculatedLineChecksum = this.tleLineChecksum(parsedTLE.arr[index]);
      const parsedChecksum = this[`getChecksum${lineNumber}`](parsedTLE);
      const checksumIsValid = parsedChecksum === calculatedLineChecksum;

      if (!lineNumberIsValid || !checksumIsValid) {
        isValid = false;
      }
    });

    return isValid;
  },

  /**
   * "The checksums for each line are calculated by adding all numerical digits on that line,
   * including the line number. One is added to the checksum for each negative sign (−) on that
   * line. All other non-digit characters are ignored."
   */
  tleLineChecksum: function(tleLine) {
    let charArr = tleLine.split('');

    // Remove trailing checksum.
    charArr.splice(charArr.length - 1, 1);

    if (charArr.length === 0) {
      throw new Error('Character array empty!', tleLine);
    }

    const checksum = charArr.reduce((sum, val) => {
      const parsedVal = parseInt(val);
      const parsedSum = parseInt(sum);

      if (Number.isInteger(parsedVal)) {
        return parsedSum + parsedVal;
      }
      if (val === '-') {
        return parsedSum + 1;
      }

      return parsedSum;
    });

    return checksum % 10;
  },

  /**
   * Creates simple getters for each part of a TLE.
   */
  createTLEGetters: function(){
    var self = this;

    // Create getters.
    Object.keys(tleLines).forEach((tleLine) => {
      Object.keys(tleLines[tleLine]).forEach((prop) => {
        self[self.toCamelCase('get-' + prop)] = (tle) => {
          // Parse TLE if needed.
          const isParsedTLE = typeof tle === 'object' && tle.arr;
          const parsedTLE = this.parseTLE(tle);

          const tleArr = parsedTLE.arr;
          const line = (tleLine === 'line1') ? tleArr[0] : tleArr[1];
          const start = tleLines[tleLine][prop].start;
          const length = tleLines[tleLine][prop].length;

          const substr = line.substr(start, length);

          const intSubstr = parseFloat(substr);
          const output = (Number.isFinite(intSubstr)) ? intSubstr : substr;

          return output;
        }
      });
    });
  },

  toCamelCase: function(str, divider){
    divider = divider || '-';

    var bits = str.split(divider);

    var output = [];

    output.push(bits[0]);

    for(var i=1, len=bits.length; i<len; i++) {
      output.push(bits[i].substr(0, 1).toUpperCase() + bits[i].substr(1, bits[i].length - 1));
    }

    return output.join('');
  },

  getEpochTimestamp: function(tle) {
    var epochDay = this.getEpochDay(tle);
    var epochYear = this.getEpochYear(tle);

    return this.dayOfYearToTimeStamp(epochDay, epochYear);
  },

  // Use satellite.js.
  getSatelliteInfo: function(tle, timestamp, observerLat, observerLng, observerHeight) {
    const fnName = 'getSatelliteInfo';

    const timestampCopy = timestamp || Date.now();

    const isParsedTLE = typeof tle === 'object' && tle.arr;
    const tleArr = this.parseTLE(tle).arr;

    // Memoization
    const cacheKey = `${fnName}-${tleArr[0]}-${tleArr[1]}-${timestamp}-${observerLat}-${observerLng}-${observerHeight}`;
    if (this.cache[cacheKey]) return this.cache[cacheKey];

    const defaultObserverPosition = {
      lat: 36.9613422,
      lng: -122.0308,
      height: 0.370
    }

    const obsLat = observerLat || defaultObserverPosition.lat;
    const obsLng = observerLng || defaultObserverPosition.lng;
    const obsHeight = observerHeight || defaultObserverPosition.height;

    // Initialize a satellite record
    const satrec = satellite.twoline2satrec(tleArr[0], tleArr[1]);

    const time = new Date(timestampCopy);

    // Propagate SGP4.
    const positionAndVelocity = satellite.propagate(satrec, time);

    if (satellite.error) {
      throw new Error('Error: problematic TLE with unexpected eccentricity');
    }

    // The position_velocity result is a key-value pair of ECI coordinates.
    // These are the base results from which all other coordinates are derived.
    const positionEci = positionAndVelocity.position;
    const velocityEci = positionAndVelocity.velocity;

    // Set the observer position (in radians).
    const observerGd = {
      latitude: this.degreesToRadians(obsLat),
      longitude: this.degreesToRadians(obsLng),
      height: obsHeight
    };

    // Get GMST for some coordinate transforms.
    // http://en.wikipedia.org/wiki/Sidereal_time#Definition
    const gmst = satellite.gstimeFromDate(time);

    // Get ECF, Geodetic, Look Angles, and Doppler Factor.
    const positionEcf = satellite.eciToEcf(positionEci, gmst);
    const observerEcf = satellite.geodeticToEcf(observerGd);
    const positionGd = satellite.eciToGeodetic(positionEci, gmst);
    const lookAngles = satellite.ecfToLookAngles(observerGd, positionEcf);
    const dopplerFactor = satellite.dopplerFactor(observerEcf, positionEci, velocityEci);

    const velocityKmS = Math.sqrt(Math.pow(velocityEci.x, 2) + Math.pow(velocityEci.y, 2) + Math.pow(velocityEci.z, 2));

    // The coordinates are all stored in key-value pairs.
    // ECI and ECF are accessed by `x`, `y`, `z` properties.
    const satelliteX = positionEci.x;
    const satelliteY = positionEci.y;
    const satelliteZ = positionEci.z;

    // Azimuth: is simply the compass heading from the observer's position.
    const azimuth   = lookAngles.azimuth;

    // Geodetic coords are accessed via `longitude`, `latitude`, `height`.
    const longitude = positionGd.longitude;
    const latitude  = positionGd.latitude;
    const height    = positionGd.height;

    const output = {
      lng: satellite.degreesLong(longitude),    // degrees
      lat: satellite.degreesLat(latitude),      // degrees
      elevation: this.radiansToDegrees(lookAngles.elevation), // degrees (90 deg is directly overhead)
      azimuth: this.radiansToDegrees(azimuth),  // degrees (compass heading)
      range: lookAngles.rangeSat,   // km distance from ground to spacecraft
      height: positionGd.height,    // km altitude of spacecraft
      velocity: velocityKmS
    };

    this.cache[cacheKey] = output;

    return output;
  },

  getSatGroundSpeed: function(tle, timestamp) {
    const parsedTLE = this.parseTLE(tle);
    const timestampCopy = timestamp || Date.now();
    const timestampPlus = timestampCopy + 10000;
    const position1 = this.getSatelliteInfo(parsedTLE, timestampCopy);
    const position2 = this.getSatelliteInfo(parsedTLE, timestampPlus);

    const distance = this.getDistanceBetweenPointsGround(position1.lat, position1.lng, position2.lat, position2.lng);

    const kmPerSec = distance / 10;

    return kmPerSec;
  },

  getLatLon: function(tle, timestamp) {
    const tleObj = this.parseTLE(tle);

    // Validation.
    if (!this.isValidTLE(tleObj)) {
      throw new Error('TLE could not be parsed', tle);
    }

    var satInfo = this.getSatelliteInfo(tleObj.arr, timestamp);
    return {
      lat: satInfo.lat,
      lng: satInfo.lng
    }
  },

  getLatLonArr: function(tle, timestamp) {
    const ll = this.getLatLon(tle, timestamp);
    return [ ll.lat, ll.lng ];
  },

  getDistanceBetweenPointsGround: function distance(lat1, lon1, lat2, lon2) {
    var p = 0.017453292519943295;    // Math.PI / 180
    var c = Math.cos;
    var a = 0.5 - c((lat2 - lat1) * p)/2 +
            c(lat1 * p) * c(lat2 * p) *
            (1 - c((lon2 - lon1) * p))/2;

    return 12742 * Math.asin(Math.sqrt(a)); // 2 * R; R = 6371 km
  },

  getLookAngles: function(tle, timestamp, lat, lng, height) {
    const satInfo = this.getSatelliteInfo(tle, timestamp);

    return {
      elevation: satInfo.elevation,
      azimuth: satInfo.azimuth,
      range: satInfo.range  // km?
    }
  },

  radiansToDegrees: function(radians) {
    return radians * (180 / Math.PI);
  },

  degreesToRadians: function(degrees) {
    return degrees * (Math.PI / 180);
  },

  getLatLonAtEpoch: function(tle) {
    return this.getLatLon(tle, this.getEpochTimestamp(tle));
  },

  getAverageOrbitLengthMins: function(tle) {
    return  (24 * 60) / this.getMeanMotion(tle);
  },

  dayOfYearToTimeStamp: function(dayOfYear, year) {
    year = year || (new Date()).getFullYear();
    var dayMS = 1000 * 60 * 60 * 24;
    var yearStart = new Date('1/1/' + year + ' 0:0:0 Z');

    yearStart = yearStart.getTime();

    return Math.floor(yearStart + ((dayOfYear - 1) * dayMS));
  },

  getTLEEpochTimestamp: function (tle) {
    const epochYear = this.getEpochYear(tle);
    const epochDayOfYear = this.getEpochDay(tle);
    const timestamp = this.dayOfYearToTimeStamp(epochDayOfYear, epochYear);

    return timestamp;
  },

  getGroundTrack: function (tle, stepMS) {
    //  default to 1 minute intervals
    const defaultStepMS = 1000 * 60 * 1
    const stepMSCopy = stepMS || defaultStepMS;

    //  offset: plot orbit 3 hrs into past and future
    var timeOffset = 1000 * 60 * 60 * 3,
    const now = Date.now();
    const startTime = now - timeOffset,
    const curMarkerTime = startTime,
    const endTime = now + timeOffset;

    //  generate lat/lons
    var latLngs = [];
    while(curMarkerTime < endTime) {
      latLngs.push(getLatLonArr(tle, curMarkerTime));
      curMarkerTime += stepMSCopy;
    }

    return latLngs;
  }
};

tle.init();

return tle;
}));