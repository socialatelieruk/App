import { formatMoney, moneySummary } from '../../money'
import type { Brand } from '../../types'
import { Empty } from '../../ui'
import type { AdminData } from './data'
import BrandSignups from './BrandSignups'
import { MoneySummaryView } from './Money'

const DEAL: Record<Brand['deal_type'], string> = { gifted: 'Gifted', paid: 'Paid', retainer: 'Retainer' }

interface Props {
  data: AdminData
  onOpen: (b: Brand) => void
  onNew: () => void
  onPackages: () => void
  onChanged: () => void
}

export default function Brands({ data, onOpen, onNew, onPackages, onChanged }: Props) {
  const rows = data.brands.map((b) => ({
    brand: b,
    collabs: data.collabs.filter((c) => c.brand_id === b.id),
    money: moneySummary([b], data.collabs, data.finances, data.retainers, data.brandPayments),
  }))
  // Brands that owe money first, then alphabetical.
  rows.sort((a, b) => b.money.overdue - a.money.overdue || b.money.outstanding - a.money.outstanding || a.brand.name.localeCompare(b.brand.name))

  return (
    <>
      <header className="page-header with-action">
        <h1>Brands</h1>
        <div className="header-actions">
          <button className="secondary small" onClick={onPackages}>
            Packages
          </button>
          <button className="primary small" onClick={onNew}>
            + New
          </button>
        </div>
      </header>

      <BrandSignups accounts={data.brandAccounts} brands={data.brands} onChanged={onChanged} />

      <MoneySummaryView summary={moneySummary(data.brands, data.collabs, data.finances, data.retainers, data.brandPayments)} />

      {rows.length === 0 ? (
        <Empty>No brands yet. Tap “New” to add your first client.</Empty>
      ) : (
        <ul className="list">
          {rows.map(({ brand, collabs, money }) => (
            <li key={brand.id}>
              <button className="card brand-row" onClick={() => onOpen(brand)}>
                <div className="card-top">
                  <strong className="card-title">{brand.name}</strong>
                  <span className="badge" data-deal={brand.deal_type}>
                    {DEAL[brand.deal_type]}
                    {brand.deal_type === 'retainer' && brand.monthly_fee ? ` · ${formatMoney(brand.monthly_fee)}/mo` : ''}
                  </span>
                </div>
                <span className="muted small">
                  {[brand.area, `${collabs.length} collab${collabs.length === 1 ? '' : 's'}`, brand.contact_name].filter(Boolean).join(' · ')}
                </span>
                {data.brandAccounts.some((a) => a.brand_id === brand.id && a.status === 'approved') && <span className="reliability-label">Uses the brand portal</span>}
                {money.outstanding > 0 && (
                  <span className="owed small">
                    {formatMoney(money.outstanding)} outstanding{money.overdue ? ` · ${formatMoney(money.overdue)} overdue` : ''}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
