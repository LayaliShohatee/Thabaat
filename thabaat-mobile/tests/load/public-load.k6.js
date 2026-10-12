import http from 'k6/http'
import { check, sleep } from 'k6'
export const options = { scenarios: { browse: { executor: 'ramping-vus', startVUs: 0, stages: [{ duration: '15s', target: 25 }, { duration: '30s', target: 25 }, { duration: '10s', target: 0 }] } }, thresholds: { http_req_duration: ['p(95)<1000'], http_req_failed: ['rate<0.01'] } }
const base = __ENV.BASE, key = __ENV.KEY
const h = { headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } }
export default function () {
  const list = http.post(`${base}/rest/v1/rpc/reviewed_public_events`, '{}', h)
  check(list, { 'public events 200': r => r.status === 200 })
  const health = http.get(`${base}/auth/v1/health`, h)
  check(health, { 'auth health 200': r => r.status === 200 })
  sleep(1)
}
