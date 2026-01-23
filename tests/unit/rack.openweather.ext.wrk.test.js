'use strict'

const test = require('brittle')
const WrkOpenWeatherRack = require('../../workers/rack.openweather.ext.wrk')
const { ICON_MAP } = require('../../workers/constants')

test('WrkOpenWeatherRack getWrkExtData', (t) => {
  const mockData = { site1: { temperature: 20 } }

  const worker = Object.create(WrkOpenWeatherRack.prototype)
  worker.openWeatherData = mockData

  const result = worker.getWrkExtData()

  t.alike(result, mockData, 'should return openWeatherData')
})

test('WrkOpenWeatherRack get24hTemperature', (t) => {
  const worker = Object.create(WrkOpenWeatherRack.prototype)

  // Use fixed timestamps relative to current time to ensure they're within 24h window
  const now = Math.floor(Date.now() / 1000)
  const oneHour = 3600
  const data = [
    { dt: now - oneHour, temp: 15, humidity: 50, weather: [{ description: 'clear' }] },
    { dt: now + 100, temp: 20, humidity: 60, weather: [{ description: 'sunny' }] },
    { dt: now + oneHour, temp: 22, humidity: 65, weather: [{ description: 'cloudy' }] },
    { dt: now + (2 * oneHour), temp: 23, humidity: 70, weather: [{ description: 'partly cloudy' }] },
    { dt: now + (25 * oneHour), temp: 18, humidity: 55, weather: [{ description: 'rainy' }] }
  ]

  const result = worker.get24hTemperature(data)

  t.ok(Array.isArray(result), 'should return an array')
  t.ok(result.length >= 2, 'should filter to entries within 24 hours')
  // Check that all results are within the 24h window
  const nowMs = Date.now()
  const hours24Ms = nowMs + 24 * 60 * 60 * 1000
  t.ok(result.every(entry => entry.datetime >= nowMs && entry.datetime <= hours24Ms), 'should only include entries within 24 hours')
  // Check that results are sorted by datetime (first entry should be earliest)
  if (result.length > 0) {
    t.ok(result[0].datetime >= nowMs, 'first entry should be at or after now')
    t.ok(result[0].temperature, 'should have temperature')
    t.ok(result[0].humidity, 'should have humidity')
    t.ok(result[0].description, 'should have description')
  }
})

test('WrkOpenWeatherRack get24hTemperature with null/undefined data', (t) => {
  const worker = Object.create(WrkOpenWeatherRack.prototype)

  t.is(worker.get24hTemperature(null), undefined, 'should handle null data')
  t.is(worker.get24hTemperature(undefined), undefined, 'should handle undefined data')
  t.alike(worker.get24hTemperature([]), [], 'should handle empty array')
})

test('WrkOpenWeatherRack getWeatherOverview', (t) => {
  const worker = Object.create(WrkOpenWeatherRack.prototype)

  const mockData = {
    current: {
      temp: 22.5,
      weather: [{ icon: '01d', description: 'clear sky' }],
      clouds: 10,
      visibility: 10000,
      humidity: 65,
      wind_speed: 5.5,
      wind_deg: 180
    },
    timezone: 'UTC',
    timezone_offset: -18000
  }

  const result = worker.getWeatherOverview(mockData)

  t.is(result.temperature, 22.5, 'should extract temperature')
  t.is(result.icon, ICON_MAP['01d'], 'should map icon correctly')
  t.is(result.clouds, 10, 'should extract clouds')
  t.is(result.visibility, 10000, 'should extract visibility')
  t.is(result.humidity, 65, 'should extract humidity')
  t.is(result.wind.speed, 5.5, 'should extract wind speed')
  t.is(result.wind.deg, 180, 'should extract wind degree')
  t.is(result.timezone, 'UTC', 'should extract timezone')
  t.ok(result.time, 'should include time string')
})

test('WrkOpenWeatherRack get5dForecast', (t) => {
  const worker = Object.create(WrkOpenWeatherRack.prototype)

  const mockData = [
    { dt: 1000, temp: { day: 20 }, humidity: 50, weather: [{ description: 'day0' }] },
    { dt: 2000, temp: { day: 21 }, humidity: 55, weather: [{ description: 'day1' }] },
    { dt: 3000, temp: { day: 22 }, humidity: 60, weather: [{ description: 'day2' }] },
    { dt: 4000, temp: { day: 23 }, humidity: 65, weather: [{ description: 'day3' }] },
    { dt: 5000, temp: { day: 24 }, humidity: 70, weather: [{ description: 'day4' }] },
    { dt: 6000, temp: { day: 25 }, humidity: 75, weather: [{ description: 'day5' }] },
    { dt: 7000, temp: { day: 26 }, humidity: 80, weather: [{ description: 'day6' }] }
  ]

  const result = worker.get5dForecast(mockData)

  t.is(result.length, 5, 'should return 5 days')
  t.is(result[0].datetime, 2000 * 1000, 'should skip first entry')
  t.is(result[0].temperature, 21, 'should map temperature correctly')
  t.is(result[0].humidity, 55, 'should map humidity correctly')
  t.is(result[0].description, 'day1', 'should map description correctly')
  t.is(result[4].datetime, 6000 * 1000, 'should include 5th day')
})

test('WrkOpenWeatherRack getForecast', (t) => {
  const worker = Object.create(WrkOpenWeatherRack.prototype)

  const mockDaily = [
    { dt: 1000, temp: { day: 20 }, humidity: 50, weather: [{ description: 'day0' }] },
    { dt: 2000, temp: { day: 21 }, humidity: 55, weather: [{ description: 'day1' }] }
  ]

  const now = Math.floor(Date.now() / 1000)
  const mockHourly = [
    { dt: now, temp: 20, humidity: 60, weather: [{ description: 'sunny' }] }
  ]

  const mockData = {
    daily: mockDaily,
    hourly: mockHourly
  }

  const result = worker.getForecast(mockData)

  t.ok(result.forecast5d, 'should include 5-day forecast')
  t.ok(result.forecast24h, 'should include 24-hour forecast')
  t.is(result.forecast5d.length, 1, 'should have correct 5d forecast length')
})

test('WrkOpenWeatherRack getWeatherHandler success', async (t) => {
  const worker = Object.create(WrkOpenWeatherRack.prototype)

  const mockWeatherData = {
    current: {
      temp: 20,
      weather: [{ icon: '01d' }],
      clouds: 0,
      visibility: 10000,
      humidity: 60,
      wind_speed: 5,
      wind_deg: 180
    },
    timezone: 'UTC',
    timezone_offset: 0,
    hourly: [],
    daily: []
  }

  worker.openWeahterApi = {
    getWeatherOneCall: async (lat, lon) => mockWeatherData
  }
  worker.getWeatherOverview = (data) => ({ temperature: data.current.temp })
  worker.getForecast = (data) => ({ forecast5d: [], forecast24h: [] })
  worker.logger = { error: () => {} }

  const result = await worker.getWeatherHandler(40.7128, -74.0060)

  t.ok(result.overview, 'should include overview')
  t.ok(result.forecast5d, 'should include forecast5d')
  t.ok(result.forecast24h, 'should include forecast24h')
  t.is(result.overview.temperature, 20, 'should have correct temperature')
})

test('WrkOpenWeatherRack getWeatherHandler error handling', async (t) => {
  const worker = Object.create(WrkOpenWeatherRack.prototype)

  let errorLogged = false
  worker.openWeahterApi = {
    getWeatherOneCall: async () => {
      throw new Error('API Error')
    }
  }
  worker.logger = {
    error: (msg) => {
      errorLogged = true
      t.ok(msg.includes('ERR_FETCH_WEATHER_DATA'), 'should log error with correct prefix')
    }
  }

  const result = await worker.getWeatherHandler(40.7128, -74.0060)

  t.ok(errorLogged, 'should log error')
  t.alike(result, { error: 'Failed to fetch weather data.' }, 'should return error object')
})

test('WrkOpenWeatherRack getCityByCoordinates success', async (t) => {
  const worker = Object.create(WrkOpenWeatherRack.prototype)

  const mockResponse = [{ name: 'New York' }, { name: 'Brooklyn' }]

  worker.openWeahterApi = {
    getCity: async (lat, lon) => mockResponse
  }
  worker.logger = { error: () => {} }

  const result = await worker.getCityByCoordinates(40.7128, -74.0060)

  t.is(result, 'New York', 'should return first city name')
})

test('WrkOpenWeatherRack getCityByCoordinates empty response', async (t) => {
  const worker = Object.create(WrkOpenWeatherRack.prototype)

  let errorLogged = false
  worker.openWeahterApi = {
    getCity: async () => []
  }
  worker.logger = {
    error: (msg) => {
      errorLogged = true
      t.ok(msg.includes('No city found'), 'should log appropriate error')
    }
  }

  const result = await worker.getCityByCoordinates(40.7128, -74.0060)

  t.ok(errorLogged, 'should log error')
  t.is(result, null, 'should return null for empty response')
})

test('WrkOpenWeatherRack getCityByCoordinates error handling', async (t) => {
  const worker = Object.create(WrkOpenWeatherRack.prototype)

  let errorLogged = false
  worker.openWeahterApi = {
    getCity: async () => {
      throw new Error('API Error')
    }
  }
  worker.logger = {
    error: (msg) => {
      errorLogged = true
      t.ok(msg.includes('ERR_FETCH_CITY_COORDINATES'), 'should log error with correct prefix')
    }
  }

  const result = await worker.getCityByCoordinates(40.7128, -74.0060)

  t.ok(errorLogged, 'should log error')
  t.is(result, null, 'should return null on error')
})

test('WrkOpenWeatherRack _saveToDb and _readFromDb', async (t) => {
  const worker = Object.create(WrkOpenWeatherRack.prototype)

  const testData = { site1: { temperature: 20 } }
  let savedData = null

  worker.openWeatherDb = {
    put: async (key, value) => {
      t.is(key, 'openweather', 'should use correct key')
      savedData = JSON.parse(value.toString())
    },
    get: async (key) => {
      t.is(key, 'openweather', 'should use correct key')
      if (savedData) {
        return { value: Buffer.from(JSON.stringify(savedData)) }
      }
      return null
    }
  }

  await worker._saveToDb(testData)
  const result = await worker._readFromDb()

  t.alike(result, testData, 'should save and read data correctly')
})

test('WrkOpenWeatherRack _readFromDb with no data', async (t) => {
  const worker = Object.create(WrkOpenWeatherRack.prototype)

  worker.openWeatherDb = {
    get: async () => null
  }

  const result = await worker._readFromDb()

  t.is(result, null, 'should return null when no data exists')
})

test('WrkOpenWeatherRack fetchOpenWeatherData', async (t) => {
  const worker = Object.create(WrkOpenWeatherRack.prototype)

  const mockSites = [
    { lat: 40.7128, lon: -74.0060, name: 'site1' },
    { lat: 51.5074, lon: -0.1278, name: 'site2' }
  ]

  let savedData = null
  let callCount = 0

  worker.openWeatherData = {}
  worker.conf = {
    apiConf: {
      sites: mockSites
    }
  }
  worker.getWeatherHandler = async (lat, lon) => {
    callCount++
    return { temperature: 20 + callCount }
  }
  worker._saveToDb = async (data) => {
    savedData = data
  }
  worker.logger = { error: () => {} }
  worker.fetchingData = false

  await worker.fetchOpenWeatherData()

  t.is(callCount, 2, 'should call getWeatherHandler for each site')
  t.ok(savedData.site1, 'should save data for site1')
  t.ok(savedData.site2, 'should save data for site2')
  t.is(worker.fetchingData, false, 'should reset fetchingData flag')
})

test('WrkOpenWeatherRack fetchOpenWeatherData prevents concurrent fetches', async (t) => {
  const worker = Object.create(WrkOpenWeatherRack.prototype)

  let callCount = 0

  worker.openWeatherData = {}
  worker.conf = {
    apiConf: {
      sites: [{ lat: 40.7128, lon: -74.0060, name: 'site1' }]
    }
  }
  worker.getWeatherHandler = async () => {
    callCount++
    // Simulate slow API call
    await new Promise(resolve => setTimeout(resolve, 10))
    return { temperature: 20 }
  }
  worker._saveToDb = async () => {}
  worker.logger = { error: () => {} }
  worker.fetchingData = false

  // Start two concurrent fetches
  const promise1 = worker.fetchOpenWeatherData()
  const promise2 = worker.fetchOpenWeatherData()

  await Promise.all([promise1, promise2])

  t.is(callCount, 1, 'should only fetch once when called concurrently')
})

test('WrkOpenWeatherRack fetchOpenWeatherData error handling', async (t) => {
  const worker = Object.create(WrkOpenWeatherRack.prototype)

  let errorLogged = false

  worker.openWeatherData = {}
  worker.conf = {
    apiConf: {
      sites: [{ lat: 40.7128, lon: -74.0060, name: 'site1' }]
    }
  }
  worker.getWeatherHandler = async () => {
    throw new Error('API Error')
  }
  worker._saveToDb = async () => {}
  worker.logger = {
    error: (msg) => {
      errorLogged = true
      t.ok(msg.includes('ERR_FETCH_OPENWEATHER_DATA'), 'should log error with correct prefix')
    }
  }
  worker.fetchingData = false

  await worker.fetchOpenWeatherData()

  t.ok(errorLogged, 'should log error')
  t.is(worker.fetchingData, false, 'should reset fetchingData flag even on error')
})

test('WrkOpenWeatherRack fetchOpenWeatherData with empty sites', async (t) => {
  const worker = Object.create(WrkOpenWeatherRack.prototype)

  worker.openWeatherData = {}
  worker.conf = {
    apiConf: {
      sites: []
    }
  }
  worker.getWeatherHandler = async () => {
    t.fail('should not call getWeatherHandler')
  }
  worker._saveToDb = async (data) => {
    t.alike(data, {}, 'should save empty data')
  }
  worker.logger = { error: () => {} }
  worker.fetchingData = false

  await worker.fetchOpenWeatherData()

  t.pass('should handle empty sites array')
})
