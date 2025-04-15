import axios from 'axios'

const APP_ID = process.env.APP_ID
const APP_SECRET = process.env.APP_SECRET
const BACKEND_URL = process.env.BACKEND_URL

let authToken: string | null = null
let isRefreshing = false
let refreshSubscribers: ((token: string) => void)[] = []

function subscribeTokenRefresh(cb: (token: string) => void) {
    refreshSubscribers.push(cb)
    console.log('[authAxios] Queued request during token refresh. Subscribers:', refreshSubscribers.length)
}

function onRefreshed(token: string) {
    console.log('[authAxios] Token refresh complete. Resolving subscribers...')
    refreshSubscribers.forEach((cb) => cb(token))
    refreshSubscribers = []
}

// get auth token for twake drive app
export async function getAuthToken(): Promise<string> {
    const resp = (await axios.post(`${BACKEND_URL}/api/console/v1/login`, {
        id: APP_ID,
        secret: APP_SECRET,
    }, {
        headers: {
            'Content-Type': 'application/json',
        },
    })).data
    return resp.resource.access_token.value
}

async function refreshAuthToken() {
    console.log('[authAxios] Refreshing auth token...')
    try {
        authToken = await getAuthToken()
        console.log('[authAxios] ✅ Token refreshed successfully')
        return authToken
    } catch (err) {
        console.error('[authAxios] ❌ Failed to refresh token:', err)
        throw err
    }
}

const authAxios = axios.create()

authAxios.interceptors.request.use(
    async (config) => {
        if (!authToken) {
            console.log('[authAxios] No token present, fetching...')
            authToken = await getAuthToken()
            console.log('[authAxios] ✅ Got initial token')
        }
        console.log('[authAxios] Adding auth token to request headers:', authToken)
        config.headers = config.headers || {}
        config.headers['Authorization'] = `Bearer ${authToken}`
        return config
    },
    (error) => {
        console.error('[authAxios] ❌ Request interceptor error:', error)
        return Promise.reject(error)
    }
)

authAxios.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true
            console.warn('[authAxios] ⚠️ 401 detected, retrying with new token...')

            if (isRefreshing) {
                return new Promise((resolve) => {
                    subscribeTokenRefresh((token: string) => {
                        originalRequest.headers['Authorization'] = `Bearer ${token}`
                        console.log('[authAxios] Retrying original request after token refresh')
                        resolve(authAxios(originalRequest))
                    })
                })
            }

            isRefreshing = true

            try {
                const newToken = await refreshAuthToken()
                onRefreshed(newToken)
                originalRequest.headers['Authorization'] = `Bearer ${newToken}`
                return authAxios(originalRequest)
            } catch (err) {
                console.error('[authAxios] ❌ Token refresh failed. Not retrying.')
                return Promise.reject(err)
            } finally {
                isRefreshing = false
            }
        }

        return Promise.reject(error)
    }
)

export default authAxios
