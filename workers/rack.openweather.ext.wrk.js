'use strict'

const async = require('async')
const OpenWeatherApi = require('./lib/openweather.api')
const { DEFAULT_INTERVAL, ICON_MAP } = require('./constants')
const TetherWrkBase = require('tether-wrk-base/workers/base.wrk.tether')

class WrkOpenWeatherRack extends TetherWrkBase {
  constructor (conf, ctx) {
    super(conf, ctx)

    if (!ctx.rack) {
      throw new Error('ERR_PROC_RACK_UNDEFINED')
    }

    this.prefix = `${this.wtype}-${ctx.rack}`

    this.init()
    this.start()
  }

  init () {
    super.init()

    this.loadConf('openweather', 'apiConf')

    this.setInitFacs([
      ['fac', 'hp-svc-facs-store', 's1', 's1', {
        storeDir: `store/${this.ctx.rack}-db`
      }, 0],
      ['fac', 'bfx-facs-interval', '0', 'openweather', {}, -10],
      ['fac', 'bfx-facs-http', '0', '0', {
        baseUrl: this.conf.apiConf.openweather.baseUrl,
        timeout: 30 * 1000
      }, 0]
    ])

    this.openWeatherData = {}
  }

  _start (cb) {
    async.series([
      (next) => { super._start(next) },
      async () => {
        this.net_r0.rpcServer.respond('getWrkExtData', async (req) => {
          return await this.net_r0.handleReply('getWrkExtData', req)
        })

        this.openWeatherDb = await this.store_s1.getBee({ name: 'openweather' }, { keyEncoding: 'utf-8' })
        await this.openWeatherDb.ready()

        const dbData = await this._readFromDb()

        if (dbData) this.openWeatherData = dbData
        const { secretApiKey, openweather: { dataFetchIntervalMs } } = this.conf?.apiConf || {}

        this.openWeahterApi = new OpenWeatherApi(this.http_0, secretApiKey)
        await this.fetchOpenWeatherData()

        this.interval_openweather.add(
          'openweather-data-fetch',
          this.fetchOpenWeatherData.bind(this),
          dataFetchIntervalMs || DEFAULT_INTERVAL
        )
      }
    ], cb)
  }

  async _saveToDb (data) {
    await this.openWeatherDb.put('openweather', Buffer.from(JSON.stringify(data)))
  }

  async _readFromDb () {
    const data = await this.openWeatherDb.get('openweather')
    if (!data) return null
    return JSON.parse(data.value.toString())
  }

  getWrkExtData () {
    return this.openWeatherData
  }

  /**
   * Get temperature data for the next 24 hours
   * @param data
   * @returns {Object}
   */
  get24hTemperature (data) {
    const now = new Date()
    const hours24 = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    const data24h = data?.filter(entry => {
      const entryDate = new Date(entry.dt * 1000)
      return entryDate >= now && entryDate <= hours24
    })

    return data24h?.map(entry => ({
      datetime: entry.dt * 1000,
      temperature: entry.temp,
      humidity: entry.humidity,
      description: entry.weather[0].description
    }))
  }

  /**
   * Process response to send only required data
   * @param data
   * @returns {Object}
   */
  getWeatherOverview (data) {
    const {
      temp:
        temperature,
      weather,
      clouds,
      visibility,
      humidity,
      wind_speed: windSpeed,
      wind_deg: windDeg
    } = data.current
    const { icon } = weather[0]
    const { timezone, timezone_offset: timezoneOffset } = data

    return {
      temperature,
      icon: ICON_MAP[icon],
      clouds,
      visibility,
      humidity,
      wind: {
        speed: windSpeed,
        deg: windDeg
      },
      timezone,
      time: new Date(Date.now() + (timezoneOffset * 1000)).toLocaleString()
    }
  }

  /**
   * Get 5-day forecast data
   * @param data
   * @returns {Array}
   */
  get5dForecast (data) {
    const forecast = data.map(entry => ({
      datetime: entry.dt * 1000,
      temperature: entry.temp.day,
      humidity: entry.humidity,
      description: entry.weather[0].description
    }))

    // cut off the first and take the next 5 days
    return forecast.slice(1, 6)
  }

  /**
   * Get forecast weather data
   * @param data
   * @returns {Object}
   */
  getForecast (data) {
    return {
      forecast5d: this.get5dForecast(data.daily),
      forecast24h: this.get24hTemperature(data.hourly)
    }
  }

  /**
   * Get weather from OpenWeatherMap API
   * @param lat
   * @param lon
   * @returns {Promise<*>}
   */
  async getWeatherHandler (lat, lon) {
    try {
      const data = await this.openWeahterApi.getWeatherOneCall(lat, lon)
      const overview = this.getWeatherOverview(data)
      const forecast = this.getForecast(data)

      return {
        overview,
        ...forecast
      }
    } catch (err) {
      this.logger.error(`ERR_FETCH_WEATHER_DATA ${err}`)
      return { error: 'Failed to fetch weather data.' }
    }
  }

  /**
   * Get city by coordinates
   * @param lat
   * @param lon
   * @returns {Promise<*|null>}
   */
  async getCityByCoordinates (lat, lon) {
    try {
      const response = await this.openWeahterApi.getCity(lat, lon)

      if (response?.length > 0) {
        return response[0].name
      } else {
        this.logger.error('No city found for the given coordinates.')
        return null
      }
    } catch (error) {
      this.logger.error(`ERR_FETCH_CITY_COORDINATES ${error}`)
      return null
    }
  }

  /**
   * Fetch OpenWeatherMap data
   * main entry point for fetching data
   * @returns {Promise<void>}
   */
  async fetchOpenWeatherData () {
    if (this.fetchingData) return
    this.fetchingData = true

    const data = this.openWeatherData
    const sites = this.conf?.apiConf?.sites || []

    try {
      for (const site of sites) {
        const { lat, lon, name } = site

        if (!data[name]) data[name] = {}
        data[name] = await this.getWeatherHandler(lat, lon)
      }
      await this._saveToDb(data)
    } catch (e) {
      this.logger.error(`ERR_FETCH_OPENWEATHER_DATA ${e}`)
    } finally {
      this.fetchingData = false
    }
  }
}

module.exports = WrkOpenWeatherRack
