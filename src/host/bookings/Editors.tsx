import { Plus, Trash } from '@phosphor-icons/react';
import Button from '../../components/Button';
import { Field, Section, iconBtn, inputCls } from '../settings/ui';
import { MAX_DISCOUNTS, MAX_TIERS, type DiscountForm, type Errors, type FormState } from './model';
import type { DiscountKind } from '../../lib/types';

type Patch = (fn: (f: FormState) => Partial<FormState>) => void;

const DISCOUNT_KINDS: DiscountKind[] = ['percent', 'flat', 'group', 'earlybird'];

export function TiersEditor({ form, errors, patch }: { form: FormState; errors: Errors; patch: Patch }) {
  function add() {
    patch((f) => {
      let n = f.tiers.length + 1;
      while (f.tiers.some((t) => t.id === `tier-${n}`)) n++;
      return { tiers: [...f.tiers, { id: `tier-${n}`, label: '', priceInr: 0 }] };
    });
  }
  return (
    <Section title="Price tiers" intro="Up to 10 tiers. New events start with one placeholder tier at ₹0 — set real prices before opening sales.">
      <ul className="divide-y divide-line border-y border-line">
        {form.tiers.map((t, i) => (
          <li key={t.id} className="grid grid-cols-1 gap-3 py-4 md:grid-cols-[1fr_10rem_10rem_auto] md:items-end">
            <Field id={`tier-label-${t.id}`} label={`Tier ${i + 1} label`}>
              <input
                id={`tier-label-${t.id}`}
                className={inputCls}
                value={t.label}
                maxLength={60}
                onChange={(e) =>
                  patch((f) => ({ tiers: f.tiers.map((x) => (x.id === t.id ? { ...x, label: e.target.value } : x)) }))
                }
              />
            </Field>
            <Field id={`tier-price-${t.id}`} label="Price (INR)">
              <input
                id={`tier-price-${t.id}`}
                type="number"
                inputMode="numeric"
                min={0}
                className={`${inputCls} font-mono`}
                value={t.priceInr}
                onChange={(e) =>
                  patch((f) => ({
                    tiers: f.tiers.map((x) => (x.id === t.id ? { ...x, priceInr: Number(e.target.value) || 0 } : x)),
                  }))
                }
              />
            </Field>
            <Field id={`tier-discount-${t.id}`} label="Per-ticket discount % (optional)">
              <input
                id={`tier-discount-${t.id}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                className={`${inputCls} font-mono`}
                value={t.perTicketDiscountPct ?? ''}
                onChange={(e) =>
                  patch((f) => ({
                    tiers: f.tiers.map((x) =>
                      x.id === t.id
                        ? { ...x, perTicketDiscountPct: e.target.value === '' ? undefined : Number(e.target.value) }
                        : x,
                    ),
                  }))
                }
              />
            </Field>
            <button
              type="button"
              className={iconBtn}
              aria-label={`Remove ${t.label || `tier ${i + 1}`}`}
              disabled={form.tiers.length <= 1}
              onClick={() => patch((f) => ({ tiers: f.tiers.filter((x) => x.id !== t.id) }))}
            >
              <Trash size={20} weight="regular" />
            </button>
          </li>
        ))}
      </ul>
      {errors.tiers && (
        <p role="alert" className="mt-3 text-sm text-accent-text">
          {errors.tiers}
        </p>
      )}
      <Button variant="secondary" className="mt-4" disabled={form.tiers.length >= MAX_TIERS} onClick={add}>
        <Plus size={20} weight="regular" /> Add tier ({form.tiers.length}/{MAX_TIERS})
      </Button>
    </Section>
  );
}

export function DiscountsEditor({ form, errors, patch }: { form: FormState; errors: Errors; patch: Patch }) {
  const set = (id: string, p: Partial<DiscountForm>) =>
    patch((f) => ({ discounts: f.discounts.map((d) => (d.id === id ? { ...d, ...p } : d)) }));

  function add() {
    patch((f) => {
      let n = f.discounts.length + 1;
      while (f.discounts.some((d) => d.id === `discount-${n}`)) n++;
      return {
        discounts: [
          ...f.discounts,
          {
            id: `discount-${n}`,
            code: '',
            label: '',
            kind: 'percent' as DiscountKind,
            value: '0',
            minQty: '',
            validFromUtc: '',
            validToUtc: '',
            maxRedemptions: '',
            active: true,
          },
        ],
      };
    });
  }

  return (
    <Section title="Discounts" intro="Up to 20. Optional — new events start with none.">
      <ul className="divide-y divide-line border-y border-line">
        {form.discounts.map((d, i) => (
          <li key={d.id} className="grid grid-cols-1 gap-3 py-4 md:grid-cols-2 xl:grid-cols-4">
            <Field id={`disc-code-${d.id}`} label={`Discount ${i + 1} code (optional)`}>
              <input
                id={`disc-code-${d.id}`}
                className={inputCls}
                placeholder="e.g. EARLYBIRD10"
                value={d.code}
                onChange={(e) => set(d.id, { code: e.target.value })}
              />
            </Field>
            <Field id={`disc-label-${d.id}`} label="Label">
              <input id={`disc-label-${d.id}`} className={inputCls} value={d.label} onChange={(e) => set(d.id, { label: e.target.value })} />
            </Field>
            <Field id={`disc-kind-${d.id}`} label="Kind">
              <select
                id={`disc-kind-${d.id}`}
                className={inputCls}
                value={d.kind}
                onChange={(e) => set(d.id, { kind: e.target.value as DiscountKind })}
              >
                {DISCOUNT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              id={`disc-value-${d.id}`}
              label="Value"
              hint="Percent (0-100) for percent/group/earlybird, or a flat rupee amount for flat."
            >
              <input
                id={`disc-value-${d.id}`}
                type="number"
                inputMode="numeric"
                min={0}
                className={`${inputCls} font-mono`}
                value={d.value}
                onChange={(e) => set(d.id, { value: e.target.value })}
              />
            </Field>
            <Field id={`disc-minqty-${d.id}`} label="Min quantity (optional)">
              <input
                id={`disc-minqty-${d.id}`}
                type="number"
                inputMode="numeric"
                min={0}
                className={`${inputCls} font-mono`}
                value={d.minQty}
                onChange={(e) => set(d.id, { minQty: e.target.value })}
              />
            </Field>
            <Field id={`disc-maxred-${d.id}`} label="Max redemptions (optional)">
              <input
                id={`disc-maxred-${d.id}`}
                type="number"
                inputMode="numeric"
                min={0}
                className={`${inputCls} font-mono`}
                value={d.maxRedemptions}
                onChange={(e) => set(d.id, { maxRedemptions: e.target.value })}
              />
            </Field>
            <Field id={`disc-from-${d.id}`} label="Valid from (optional)">
              <input
                id={`disc-from-${d.id}`}
                type="datetime-local"
                className={`${inputCls} font-mono`}
                value={d.validFromUtc}
                onChange={(e) => set(d.id, { validFromUtc: e.target.value })}
              />
            </Field>
            <Field id={`disc-to-${d.id}`} label="Valid to (optional)">
              <input
                id={`disc-to-${d.id}`}
                type="datetime-local"
                className={`${inputCls} font-mono`}
                value={d.validToUtc}
                onChange={(e) => set(d.id, { validToUtc: e.target.value })}
              />
            </Field>
            <div className="flex items-end justify-between gap-3 xl:col-span-2">
              <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-muted">
                <input type="checkbox" checked={d.active} onChange={(e) => set(d.id, { active: e.target.checked })} />
                Active
              </label>
              <button
                type="button"
                className={iconBtn}
                aria-label={`Remove ${d.label || `discount ${i + 1}`}`}
                onClick={() => patch((f) => ({ discounts: f.discounts.filter((x) => x.id !== d.id) }))}
              >
                <Trash size={20} weight="regular" />
              </button>
            </div>
          </li>
        ))}
      </ul>
      {errors.discounts && (
        <p role="alert" className="mt-3 text-sm text-accent-text">
          {errors.discounts}
        </p>
      )}
      <Button variant="secondary" className="mt-4" disabled={form.discounts.length >= MAX_DISCOUNTS} onClick={add}>
        <Plus size={20} weight="regular" /> Add discount ({form.discounts.length}/{MAX_DISCOUNTS})
      </Button>
    </Section>
  );
}
