import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createCompany } from '../lib/companyApi'
import { useWhatsAppStatus } from '../hooks/useWhatsAppStatus.js'
import { WhatsAppConnect } from '../components/WhatsAppConnect/WhatsAppConnect'
import './Onboarding.css'

const CURRENCY_BY_COUNTRY = { MY: 'MYR', SG: 'SGD' }

export function Onboarding({ refreshUser }) {
  const navigate = useNavigate()
  const [step, setStep] = useState('company') // 'company' | 'whatsapp'
  const [form, setForm] = useState({ name: '', registrationNo: '', country: 'MY' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const { isConnected } = useWhatsAppStatus()
  const [showConnect, setShowConnect] = useState(false)

  function set(key, value) { setForm((f) => ({ ...f, [key]: value })) }

  async function saveCompany() {
    if (!form.name.trim()) { setError('Company name is required'); return }
    setBusy(true)
    setError('')
    try {
      await createCompany({
        name: form.name.trim(),
        registrationNo: form.registrationNo.trim() || undefined,
        country: form.country,
        defaultCurrency: CURRENCY_BY_COUNTRY[form.country],
      })
      await refreshUser?.()
      setStep('whatsapp')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="onb">
      <div className="onb__card">
        <div className="onb__intro">
          <span className="onb__brand">Waddle procurement workspace</span>
          <span className="onb__step-label">Setup · {step === 'company' ? 'Company details' : 'Supplier messaging'}</span>
        </div>
        <div className="onb__steps">
          <span className={`onb__dot ${step === 'company' ? 'onb__dot--active' : 'onb__dot--done'}`}>1</span>
          <span className="onb__line" />
          <span className={`onb__dot ${step === 'whatsapp' ? 'onb__dot--active' : ''}`}>2</span>
        </div>

        {step === 'company' ? (
          <>
            <h1 className="onb__title">Set up your company</h1>
            <p className="onb__subtitle">Set up the company identity used on RFQs, supplier messages, and approval records.</p>

            <label className="onb__label">Company name
              <input className="onb__input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Acme Chemicals Sdn Bhd" />
            </label>

            <label className="onb__label">Country
              <select className="onb__input" value={form.country} onChange={(e) => set('country', e.target.value)}>
                <option value="MY">Malaysia</option>
                <option value="SG">Singapore</option>
              </select>
            </label>

            <label className="onb__label">{form.country === 'SG' ? 'ACRA' : 'SSM'} registration no. <span className="onb__optional">(optional)</span>
              <input className="onb__input" value={form.registrationNo} onChange={(e) => set('registrationNo', e.target.value)} placeholder="e.g. 202401234567" />
            </label>

            {error && <p className="onb__error">{error}</p>}

            <button className="onb__btn" onClick={saveCompany} disabled={busy}>
              {busy ? 'Saving…' : 'Continue'}
            </button>
          </>
        ) : (
          <>
            <h1 className="onb__title">Connect supplier messaging</h1>
            <p className="onb__subtitle">Waddle links as a device — like WhatsApp Web — to message suppliers. Your number stays yours.</p>

            <div className={`onb__wa ${isConnected ? 'onb__wa--on' : ''}`}>
              <span className="onb__wa-dot" />
              <span><strong>{isConnected ? 'WhatsApp connected' : 'Not connected yet'}</strong><small>{isConnected ? 'Supplier outreach is available.' : 'Optional for now. Connect later from setup.'}</small></span>
            </div>

            {!isConnected && (
              <button className="onb__btn" onClick={() => setShowConnect(true)}>Connect WhatsApp</button>
            )}
            <button className="onb__btn onb__btn--ghost" onClick={() => navigate('/rfqs')}>
              {isConnected ? 'Go to your RFQs' : 'Skip for now'}
            </button>
          </>
        )}
      </div>

      {showConnect && (
        <WhatsAppConnect onConnected={() => setShowConnect(false)} onClose={() => setShowConnect(false)} />
      )}
    </div>
  )
}
