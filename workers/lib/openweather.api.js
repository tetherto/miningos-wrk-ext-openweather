'use strict'

/**
 * @see https://openweathermap.org/api
 */
class OpenWeatherApi {
  constructor (http, apiKey) {
    this._http = http
    this._secretApiKey = apiKey
  }

  async _request (apiPath) {
    const { body: resp } = await this._http.get(apiPath, { encoding: 'json' })
    return resp
  }

  async getWeatherOneCall (lat, lon) {
    const params = new URLSearchParams()
    params.append('lat', lat)
    params.append('lon', lon)
    params.append('exclude', 'minutely,alerts')
    params.append('units', 'metric')
    params.append('appid', this._secretApiKey)

    return await this._request(`/data/3.0/onecall?${params.toString()}`)
  }
}

module.exports = OpenWeatherApi
