'use strict'

const test = require('brittle')
const OpenWeatherApi = require('../../workers/lib/openweather.api')

test('OpenWeatherApi constructor', (t) => {
  const mockHttp = {}
  const apiKey = 'test-api-key'

  const api = new OpenWeatherApi(mockHttp, apiKey)

  t.is(api._http, mockHttp, 'should store http instance')
  t.is(api._secretApiKey, apiKey, 'should store API key')
})

test('OpenWeatherApi _request', async (t) => {
  const mockResponse = { temperature: 20, humidity: 60 }
  const mockHttp = {
    get: async (path, options) => {
      t.is(options.encoding, 'json', 'should use json encoding')
      return { body: mockResponse }
    }
  }

  const api = new OpenWeatherApi(mockHttp, 'test-key')
  const result = await api._request('/test/path')

  t.alike(result, mockResponse, 'should return response body')
})

test('OpenWeatherApi getWeatherOneCall', async (t) => {
  const mockWeatherData = {
    current: { temp: 20 },
    hourly: [],
    daily: []
  }

  let capturedPath = null
  const mockHttp = {
    get: async (path, options) => {
      capturedPath = path
      return { body: mockWeatherData }
    }
  }

  const api = new OpenWeatherApi(mockHttp, 'test-api-key')
  const lat = 40.7128
  const lon = -74.0060

  const result = await api.getWeatherOneCall(lat, lon)

  t.ok(capturedPath.includes('/data/3.0/onecall'), 'should call onecall endpoint')
  t.ok(capturedPath.includes('lat=40.7128'), 'should include latitude')
  t.ok(capturedPath.includes('lon=') && capturedPath.includes('-74.006'), 'should include longitude')
  t.ok(capturedPath.includes('exclude=minutely%2Calerts'), 'should exclude minutely and alerts')
  t.ok(capturedPath.includes('units=metric'), 'should use metric units')
  t.ok(capturedPath.includes('appid=test-api-key'), 'should include API key')
  t.alike(result, mockWeatherData, 'should return weather data')
})
