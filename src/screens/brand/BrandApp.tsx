import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api'
import { errorMessage, formatDate } from '../../format'
import { onBrowserClosed } from '../../links'
import { formatMoney } from '../../money'
import type { BrandAccount, BrandCampaign, BrandPayment, Brief, Package, ShortlistCard } from '../../types'
import { ErrorText, Icon, Spinner, type IconName } from '../../ui'
import BriefForm from './BriefForm'
import BrandSignupForm, { BrandPending } from './BrandSignup'
import Campaigns from './Campaigns'
import { billingLabel } from './labels'
import Packages from './Packages'
import Shortlist from './Shortlist'

type Tab = 'campaigns' | 'shortlist' | 'account'

interface PortalData {
  packages: Package[]
  payments: BrandPayment[]
  briefs: Brief[]
  campaigns: BrandCampaign[]
  shortlist: ShortlistCard[]
}

// Brand users: sign-up details → waiting for review → the portal.
export default function BrandApp() {
  const [account, setAccount] = useState<BrandAccount | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const loadAccount = useCallback(() => {
    api.getMyBrandAccount().then(setAccount, (e) => setError(errorMessage(e)))
  }, [])
  useEffect(loadAccount, [loadAccount])

  if (error) return <div className="auth"><ErrorText error={error} /></div>
  if (account === undefined) return <Spinner />
  if (account === null) return <BrandSignupForm onDone={loadAccount} />
  if (account.status !== 'approved') return <BrandPending declined={account.status === 'declined'} />
  return <Portal account={account} />
}

function Portal({ account }: { account: BrandAccount }) {
  const [tab, setTab] = useState<Tab>('campaigns')
  const [data, setData] = useState<PortalData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [choosing, setChoosing] = useState(false)
  const [briefing, setBriefing] = useState<Brief | 'new' | null>(null)

  const reload = useCallback(() => {
    Promise.all([api.listPackages(), api.listBrandPayments(), api.listBriefs(), api.getCampaigns(), api.getShortlist()]).then(
      ([packages, payments, briefs, campaigns, shortlist]) => setData({ packages, payments, briefs, campaigns, shortlist }),
      (e) => setError(errorMessage(e)),
    )
  }, [])
  useEffect(reload, [reload])
  // Coming back from Stripe Checkout: pick up the payment.
  useEffect(() => onBrowserClosed(reload), [reload])

  const changeTab = (t: Tab) => {
    setTab(t)
    reload()
  }

  if (!data) return error ? <div className="auth"><ErrorText error={error} /></div> : <Spinner />

  // A paid payment that hasn't funded a brief yet.
  const used = new Set(data.briefs.map((b) => b.payment_id))
  const credit = data.payments.find((p) => p.status === 'paid' && !used.has(p.id)) ?? null
  const waiting = data.shortlist.filter((s) => !s.decision).length

  return (
    <div className="app">
      <main>
        <ErrorText error={error} />
        {tab === 'campaigns' ? (
          <Campaigns
            account={account}
            campaigns={data.campaigns}
            briefs={data.briefs}
            credit={credit}
            packages={data.packages}
            onChoosePackage={() => setChoosing(true)}
            onNewBrief={() => setBriefing('new')}
            onEditBrief={setBriefing}
          />
        ) : tab === 'shortlist' ? (
          <Shortlist items={data.shortlist} onChanged={reload} />
        ) : (
          <BrandAccountScreen account={account} payments={data.payments} packages={data.packages} />
        )}
      </main>

      <nav className="tabbar">
        {(
          [
            ['campaigns', 'gift', 'Campaigns', false],
            ['shortlist', 'people', 'Shortlist', waiting > 0],
            ['account', 'person', 'Account', false],
          ] as [Tab, IconName, string, boolean][]
        ).map(([id, icon, label, dot]) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => changeTab(id)} aria-label={dot ? `${label}, ${waiting} waiting` : undefined}>
            <span className="tab-icon">
              <Icon name={icon} />
              {dot && <span className="dot" />}
            </span>
            {label}
          </button>
        ))}
      </nav>

      {choosing && (
        <Packages
          packages={data.packages}
          onClose={() => setChoosing(false)}
          onPaid={() => {
            setChoosing(false)
            reload()
          }}
        />
      )}
      {briefing && (
        <BriefForm
          brief={briefing === 'new' ? undefined : briefing}
          paymentId={credit?.id}
          packageId={credit?.package_id}
          onClose={() => setBriefing(null)}
          onSaved={() => {
            setBriefing(null)
            reload()
          }}
        />
      )}
    </div>
  )
}

const PAYMENT_LABEL: Record<BrandPayment['status'], string> = { pending: 'Not completed', paid: 'Paid', failed: 'Failed', cancelled: 'Not completed' }

function BrandAccountScreen({ account, payments, packages }: { account: BrandAccount; payments: BrandPayment[]; packages: Package[] }) {
  const [error, setError] = useState<string | null>(null)
  const history = payments.filter((p) => p.status === 'paid' || p.status === 'failed')
  const current = history.find((p) => p.status === 'paid')
  const currentPackage = packages.find((p) => p.id === current?.package_id)

  const deleteAccount = async () => {
    if (!confirm('Delete your login? Your campaigns stay with The Social Atelier, but you won’t be able to sign in.')) return
    try {
      await api.deleteMyAccount()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <>
      <header className="page-header">
        <h1>Account</h1>
      </header>
      <dl className="facts">
        <dt>Business</dt>
        <dd>{account.business_name}</dd>
        <dt>Contact</dt>
        <dd>{account.contact_name}</dd>
        <dt>Email</dt>
        <dd>{account.email}</dd>
        {account.phone && (
          <>
            <dt>Phone</dt>
            <dd>{account.phone}</dd>
          </>
        )}
        {account.instagram && (
          <>
            <dt>Instagram</dt>
            <dd>@{account.instagram}</dd>
          </>
        )}
        {account.website && (
          <>
            <dt>Website</dt>
            <dd>{account.website}</dd>
          </>
        )}
        <dt>Area</dt>
        <dd>
          {account.area} · {account.category}
        </dd>
      </dl>
      <p className="muted small">To change these details, email The Social Atelier.</p>

      <section>
        <h3 className="section-title">Package</h3>
        {currentPackage ? (
          <p>
            <strong>{currentPackage.name}</strong> · {currentPackage.creators} creators · {billingLabel(currentPackage)}
          </p>
        ) : (
          <p className="muted">No package yet.</p>
        )}
      </section>

      <section>
        <h3 className="section-title">Payment history</h3>
        {history.length === 0 ? (
          <p className="muted">No payments yet.</p>
        ) : (
          <ul className="list payment-history">
            {history.map((p) => (
              <li key={p.id} data-status={p.status}>
                <span>
                  {packages.find((x) => x.id === p.package_id)?.name ?? 'Package'}
                  <span className="muted small"> · {formatDate((p.paid_at ?? p.created_at).slice(0, 10))}</span>
                </span>
                <span className={p.status === 'failed' ? 'owed' : ''}>
                  {formatMoney(p.amount)} · {PAYMENT_LABEL[p.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="stack">
        <button className="secondary" onClick={() => api.signOut()}>
          Sign out
        </button>
        <button className="danger" onClick={deleteAccount}>
          Delete account
        </button>
        <ErrorText error={error} />
      </div>
    </>
  )
}
