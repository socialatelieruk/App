import { formatMoney } from '../../money'
import type { Package } from '../../types'

export const BRAND_AREAS = ['Manchester', 'Salford', 'Altrincham', 'Stockport', 'Didsbury', 'Chorlton', 'Warrington', 'Wilmslow', 'Bolton', 'Other']

export const billingLabel = (p: Pick<Package, 'billing' | 'price'>) => (p.billing === 'monthly' ? `${formatMoney(p.price)} a month` : `${formatMoney(p.price)} one-off`)
