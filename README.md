# miningos-wrk-ext-openweather

A distributed worker service that wraps the OpenWeatherMap API to provide weather data monitoring for MiningOS. This worker is part of MiningOS infrastructure ecosystem and provides real-time weather information, relevant for managing heat dissipation and renewable energy-dependent mining operations.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Running the Worker](#running-the-worker)
6. [RPC Methods](#rpc-methods)

## Overview

The worker fetches data from OpenWeatherMap API at configurable intervals, stores it persistently in memory and backs it up using Hyperbee, and exposes it via RPC methods.

## Features

- **Multi-site monitoring**: Configure and monitor weather for multiple geographic locations
- **Comprehensive weather data**: Current conditions, 24-hour forecasts, and 5-day forecasts
- **Persistent storage**: Weather data cached in Hyperbee for reliability
- **Distributed access**: RPC interface for remote data retrieval via Hyperswarm
- **Configurable intervals**: Adjustable data fetch frequencies

## Architecture

This worker extends `tether-wrk-base`, which provides:
- RPC server infrastructure via Hyperswarm
- Persistent storage via Hyperbee
- Configuration management
- Logging facilities

The worker architecture consists of:
1. **OpenWeatherApi client**: HTTP wrapper for OpenWeatherMap API
2. **Data fetcher**: Periodic polling with configurable intervals
3. **Data processor**: Transforms API responses into normalized format
4. **Storage layer**: Hyperbee-based persistence
5. **RPC server**: Exposes weather data to distributed clients

## Installation
```bash
# Clone the repository
git clone https://github.com/tetherto/miningos-weather-worker.git
cd miningos-weather-worker

# Install dependencies
npm install

# Setup configuration files
bash setup-config.sh
```

## Configuration

### OpenWeather Configuration (`config/openweather.json`)

```json
{
  "secretApiKey": "your-openweathermap-api-key",
  "openweather": {
    "baseUrl": "https://api.openweathermap.org",
    "dataFetchIntervalMs": 1800000
  },
  "sites": [
    {
      "name": "Site-Name",
      "lat": -33.333,
      "lon": -55.555
    }
  ]
}
```

#### Configuration Parameters

- **`secretApiKey`**: Your OpenWeatherMap API key (obtain from https://openweathermap.org/api)
- **`openweather.baseUrl`**: OpenWeatherMap API base URL (version 3.0 endpoint)
- **`openweather.dataFetchIntervalMs`**: Data refresh interval in milliseconds (default: 1800000 = 30 minutes)
- **`sites`**: Array of site configurations
  - **`name`**: Unique identifier for the site
  - **`lat`**: Latitude coordinate (numeric value)
  - **`lon`**: Longitude coordinate (numeric value)

## Running the Worker

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
node worker.js --wtype wrk-openweather-rack --env production --rack rack-1
```

## RPC Methods

The worker exposes the following RPC methods via Hyperswarm.

#### `getWrkExtData`

Retrieves comprehensive weather data for all configured sites.

**Request:**
```javascript
{}  // Currently accepts empty object
```

**Success Response:**
```javascript
{
  "Site-Name": {
    "overview": {
      "temperature": 25.3,          // Current temperature (°C)
      "icon": "sunny",              // standardized icon name
      "clouds": 20,                 // Cloud coverage (%)
      "visibility": 10000,          // Visibility (meters)
      "humidity": 65,               // Humidity (%)
      "wind": {
        "speed": 3.5,               // Wind speed (m/s)
        "deg": 180                  // Wind direction (degrees)
      },
      "timezone": "UTC",
      "time": "10/24/2025, 3:45:00 PM"  // Local time at site (format depends on server locale)
    },
    "forecast24h": [
      {
        "datetime": 1729785600000,  // Unix timestamp (ms)
        "temperature": 24.8,        // Temperature (°C)
        "humidity": 68,             // Humidity (%)
        "description": "clear sky"  // Weather description
      }
      // ... next 24 hours
    ],
    "forecast5d": [
      {
        "datetime": 1729900800000,  // Unix timestamp (ms)
        "temperature": 26.2,        // Day temperature (°C)
        "humidity": 62,             // Humidity (%)
        "description": "few clouds" // Weather description
      }
      // ... next 5 days
    ]
  }
}
```

**Weather Icon Mapping:**

The worker normalizes OpenWeatherMap icons to MiningOS standard icons:

| OpenWeather Icon | MiningOS Icon | Description |
|-----------------|------------|-------------|
| 01d, 01n | sunny | Clear sky |
| 02d, 02n | partlyCloudy | Few clouds |
| 03d, 03n, 04d, 04n, 50d, 50n | cloudy | Cloudy/Overcast |
| 09d, 09n, 10d, 10n | rainy | Rain |
| 11d, 11n | rainThunder | Thunderstorm |
| 13d, 13n | snowy | Snow |
