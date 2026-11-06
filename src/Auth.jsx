
import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function Auth({ onAuthenticated }) {
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')

    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
          },
        })

        if (error) throw error

        if (data.session) {
          onAuthenticated(data.session)
        } else {
          setMessage('Account created! Please check your email to verify your account, then log in.')
          setMode('login')
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error
        onAuthenticated(data.session)
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.brand}>
          <span style={styles.logo}>i.</span>
          <div>
            <strong>interio</strong>
            <small>DESIGN YOUR EVERYDAY</small>
          </div>
        </div>

        <p style={styles.eyebrow}>YOUR PERSONAL DESIGN SPACE</p>

        <h1 style={styles.heading}>
          {mode === 'login' ? 'Welcome back.' : 'Make yourself at home.'}
        </h1>

        <p style={styles.subtitle}>
          {mode === 'login'
            ? 'Sign in to continue creating beautiful spaces.'
            : 'Create your account and begin your design journey.'}
        </p>

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <label style={styles.label}>
              Full name
              <input
                style={styles.input}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                required
              />
            </label>
          )}

          <label style={styles.label}>
            Email address
            <input
              style={styles.input}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>

          <label style={styles.label}>
            Password
            <input
              style={styles.input}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              minLength={8}
              required
            />
          </label>

          {error && <p style={styles.error}>{error}</p>}
          {message && <p style={styles.success}>{message}</p>}

          <button style={styles.button} disabled={loading}>
            {loading
              ? 'Please wait...'
              : mode === 'login'
                ? 'Sign in'
                : 'Create account'}
            <span>↗</span>
          </button>
        </form>

        <p style={styles.switchText}>
          {mode === 'login'
            ? "Don't have an account?"
            : 'Already have an account?'}
          <button
            type="button"
            style={styles.switchButton}
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login')
              setError('')
              setMessage('')
            }}
          >
            {mode === 'login' ? 'Sign up' : 'Log in'}
          </button>
        </p>

        <p style={styles.footer}>
          Thoughtful spaces. Everyday living.
        </p>
      </section>
    </main>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f8f7f3',
    display: 'grid',
    placeItems: 'center',
    padding: '24px',
    fontFamily: 'Arial, sans-serif',
    color: '#292820',
  },
  card: {
    width: '100%',
    maxWidth: '460px',
    background: '#fff',
    border: '1px solid #e8e5dc',
    borderRadius: '18px',
    padding: '40px',
    boxSizing: 'border-box',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '48px',
  },
  logo: {
    background: '#7b8060',
    color: 'white',
    borderRadius: '10px',
    padding: '10px 15px',
    fontSize: '24px',
  },
  eyebrow: {
    fontSize: '11px',
    letterSpacing: '2px',
    color: '#85836f',
    marginBottom: '14px',
  },
  heading: {
    fontFamily: 'Georgia, serif',
    fontSize: '38px',
    fontWeight: 'normal',
    margin: '0 0 12px',
  },
  subtitle: {
    color: '#77756d',
    lineHeight: 1.6,
    marginBottom: '28px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '600',
    marginBottom: '18px',
  },
  input: {
    display: 'block',
    width: '100%',
    boxSizing: 'border-box',
    padding: '14px',
    marginTop: '8px',
    border: '1px solid #dedbd1',
    borderRadius: '8px',
    fontSize: '14px',
    outlineColor: '#7b8060',
  },
  button: {
    width: '100%',
    padding: '16px',
    marginTop: '10px',
    background: '#777d5d',
    color: 'white',
    border: 0,
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
  },
  switchText: {
    textAlign: 'center',
    fontSize: '13px',
    marginTop: '24px',
    color: '#77756d',
  },
  switchButton: {
    border: 0,
    background: 'transparent',
    color: '#777d5d',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginLeft: '6px',
  },
  error: { color: '#b54738', fontSize: '13px' },
  success: { color: '#39744a', fontSize: '13px', lineHeight: 1.5 },
  footer: {
    textAlign: 'center',
    color: '#99968c',
    fontSize: '11px',
    marginTop: '36px',
  },
}
