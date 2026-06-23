import { test, expect } from '@playwright/test'

// POST /auth/register — success
test('register new user with valid data returns 201 and user object', async ({ request }) => {
  const response = await request.post('http://localhost:3000/auth/register', {
    data: {
      name: 'Alice Johnson',
      email: `alice+${Date.now()}@example.com`,
      password: 'SecurePass123!'
    }
  })
  expect(response.status()).toBe(201)
  const body = await response.json()
  expect(body.id).toBeTruthy()
  expect(body.email).toContain('@example.com')
  expect(body.password).toBeUndefined()
})

// POST /auth/register — error: duplicate email
test('register with existing email returns 422', async ({ request }) => {
  const payload = {
    name: 'Bob Smith',
    email: 'bob@example.com',
    password: 'SecurePass123!'
  }
  await request.post('http://localhost:3000/auth/register', { data: payload })
  const response = await request.post('http://localhost:3000/auth/register', { data: payload })
  expect(response.status()).toBe(422)
  const body = await response.json()
  expect(body.message ?? body.error).toBeTruthy()
})

// POST /auth/register — error: missing required fields
test('register with missing password returns 422', async ({ request }) => {
  const response = await request.post('http://localhost:3000/auth/register', {
    data: {
      name: 'Charlie',
      email: 'charlie@example.com'
    }
  })
  expect(response.status()).toBe(422)
})

// POST /auth/login — success
test('login with valid credentials returns 200 and tokens', async ({ request }) => {
  await request.post('http://localhost:3000/auth/register', {
    data: {
      name: 'Diana Prince',
      email: 'diana@example.com',
      password: 'SecurePass123!'
    }
  })
  const response = await request.post('http://localhost:3000/auth/login', {
    data: {
      email: 'diana@example.com',
      password: 'SecurePass123!'
    }
  })
  expect(response.status()).toBe(200)
  const body = await response.json()
  expect(body.accessToken ?? body.access_token ?? body.token).toBeTruthy()
  expect(body.refreshToken ?? body.refresh_token).toBeTruthy()
})

// POST /auth/login — error: wrong password
test('login with wrong password returns 401', async ({ request }) => {
  const response = await request.post('http://localhost:3000/auth/login', {
    data: {
      email: 'diana@example.com',
      password: 'WrongPassword!'
    }
  })
  expect(response.status()).toBe(401)
})

// POST /auth/login — error: non-existent user
test('login with unknown email returns 401', async ({ request }) => {
  const response = await request.post('http://localhost:3000/auth/login', {
    data: {
      email: 'ghost@example.com',
      password: 'SecurePass123!'
    }
  })
  expect(response.status()).toBe(401)
})

// POST /auth/refresh — success
test('refresh with valid refresh token returns new access token', async ({ request }) => {
  await request.post('http://localhost:3000/auth/register', {
    data: {
      name: 'Eve Torres',
      email: 'eve@example.com',
      password: 'SecurePass123!'
    }
  })
  const loginRes = await request.post('http://localhost:3000/auth/login', {
    data: { email: 'eve@example.com', password: 'SecurePass123!' }
  })
  const { refreshToken, refresh_token } = await loginRes.json()
  const token = refreshToken ?? refresh_token

  const response = await request.post('http://localhost:3000/auth/refresh', {
    data: { refreshToken: token }
  })
  expect(response.status()).toBe(200)
  const body = await response.json()
  expect(body.accessToken ?? body.access_token ?? body.token).toBeTruthy()
})

// POST /auth/refresh — error: invalid token
test('refresh with invalid token returns 401', async ({ request }) => {
  const response = await request.post('http://localhost:3000/auth/refresh', {
    data: { refreshToken: 'invalid.token.value' }
  })
  expect(response.status()).toBe(401)
})

// POST /auth/logout — success
test('logout with valid access token returns 200', async ({ request }) => {
  await request.post('http://localhost:3000/auth/register', {
    data: {
      name: 'Frank Castle',
      email: 'frank@example.com',
      password: 'SecurePass123!'
    }
  })
  const loginRes = await request.post('http://localhost:3000/auth/login', {
    data: { email: 'frank@example.com', password: 'SecurePass123!' }
  })
  const body = await loginRes.json()
  const token = body.accessToken ?? body.access_token ?? body.token

  const response = await request.post('http://localhost:3000/auth/logout', {
    headers: { Authorization: `Bearer ${token}` },
    data: {}
  })
  expect(response.status()).toBe(200)
})

// POST /auth/logout — error: no token
test('logout without token returns 401', async ({ request }) => {
  const response = await request.post('http://localhost:3000/auth/logout', {
    data: {}
  })
  expect(response.status()).toBe(401)
})

// GET /auth/me — success
test('get current user with valid token returns user profile', async ({ request }) => {
  await request.post('http://localhost:3000/auth/register', {
    data: {
      name: 'Grace Hopper',
      email: 'grace@example.com',
      password: 'SecurePass123!'
    }
  })
  const loginRes = await request.post('http://localhost:3000/auth/login', {
    data: { email: 'grace@example.com', password: 'SecurePass123!' }
  })
  const body = await loginRes.json()
  const token = body.accessToken ?? body.access_token ?? body.token

  const response = await request.get('http://localhost:3000/auth/me', {
    headers: { Authorization: `Bearer ${token}` }
  })
  expect(response.status()).toBe(200)
  const profile = await response.json()
  expect(profile.email).toBe('grace@example.com')
  expect(profile.name).toBe('Grace Hopper')
  expect(profile.password).toBeUndefined()
})

// GET /auth/me — error: no token
test('get current user without token returns 401', async ({ request }) => {
  const response = await request.get('http://localhost:3000/auth/me')
  expect(response.status()).toBe(401)
})

// GET /auth/me — error: expired/invalid token
test('get current user with invalid token returns 401', async ({ request }) => {
  const response = await request.get('http://localhost:3000/auth/me', {
    headers: { Authorization: 'Bearer eyInvalidToken.abc.xyz' }
  })
  expect(response.status()).toBe(401)
})