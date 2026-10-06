import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Plus, Trash } from '@phosphor-icons/react';
import Button from '../../components/Button';
import { Field, Section, iconBtn, inputCls } from '../settings/ui';
import { MAX_DISCOUNTS, MAX_TIERS } from './model';
const DISCOUNT_KINDS = ['percent', 'flat', 'group', 'earlybird'];
export function TiersEditor({ form, errors, patch }) {
    function add() {
        patch((f) => {
            let n = f.tiers.length + 1;
            while (f.tiers.some((t) => t.id === `tier-${n}`))
                n++;
            return { tiers: [...f.tiers, { id: `tier-${n}`, label: '', priceInr: 0, capacity: 0, seatsPerTicket: 1 }] };
        });
    }
    return (_jsxs(Section, { title: "Price tiers", intro: "Up to 10 tiers. New events start with one placeholder tier at \u20B90 \u2014 set real prices before opening sales.", children: [_jsx("ul", { className: "divide-y divide-line border-y border-line", children: form.tiers.map((t, i) => (_jsxs("li", { className: "grid grid-cols-1 gap-3 py-4 md:grid-cols-[1fr_10rem_10rem_8rem_8rem_auto] md:items-end", children: [_jsx(Field, { id: `tier-label-${t.id}`, label: `Tier ${i + 1} label`, children: _jsx("input", { id: `tier-label-${t.id}`, className: inputCls, value: t.label, maxLength: 60, onChange: (e) => patch((f) => ({ tiers: f.tiers.map((x) => (x.id === t.id ? { ...x, label: e.target.value } : x)) })) }) }), _jsx(Field, { id: `tier-price-${t.id}`, label: "Price (INR)", children: _jsx("input", { id: `tier-price-${t.id}`, type: "number", inputMode: "numeric", min: 0, className: `${inputCls} font-mono`, value: t.priceInr, onChange: (e) => patch((f) => ({
                                    tiers: f.tiers.map((x) => (x.id === t.id ? { ...x, priceInr: Number(e.target.value) || 0 } : x)),
                                })) }) }), _jsx(Field, { id: `tier-capacity-${t.id}`, label: "Tier capacity (0 = unlimited)", children: _jsx("input", { id: `tier-capacity-${t.id}`, type: "number", inputMode: "numeric", min: 0, className: `${inputCls} font-mono`, value: t.capacity ?? '', onChange: (e) => patch((f) => ({
                                    tiers: f.tiers.map((x) => (x.id === t.id ? { ...x, capacity: e.target.value === '' ? 0 : Number(e.target.value) } : x)),
                                })) }) }), _jsx(Field, { id: `tier-seats-${t.id}`, label: "Seats per ticket", hint: "1 = standard, 2 = ticket for 2 entries, etc.", children: _jsx("input", { id: `tier-seats-${t.id}`, type: "number", inputMode: "numeric", min: 1, className: `${inputCls} font-mono w-20`, value: t.seatsPerTicket ?? 1, onChange: (e) => patch((f) => ({
                                    tiers: f.tiers.map((x) => (x.id === t.id ? { ...x, seatsPerTicket: Number(e.target.value) || 1 } : x)),
                                })) }) }), _jsx(Field, { id: `tier-discount-${t.id}`, label: "Per-ticket discount % (optional)", children: _jsx("input", { id: `tier-discount-${t.id}`, type: "number", inputMode: "numeric", min: 0, max: 100, className: `${inputCls} font-mono`, value: t.perTicketDiscountPct ?? '', onChange: (e) => patch((f) => ({
                                    tiers: f.tiers.map((x) => x.id === t.id
                                        ? { ...x, perTicketDiscountPct: e.target.value === '' ? undefined : Number(e.target.value) }
                                        : x),
                                })) }) }), _jsx("button", { type: "button", className: iconBtn, "aria-label": `Remove ${t.label || `tier ${i + 1}`}`, disabled: form.tiers.length <= 1, onClick: () => patch((f) => ({ tiers: f.tiers.filter((x) => x.id !== t.id) })), children: _jsx(Trash, { size: 20, weight: "regular" }) })] }, t.id))) }), errors.tiers && (_jsx("p", { role: "alert", className: "mt-3 text-sm text-accent-text", children: errors.tiers })), _jsxs(Button, { variant: "secondary", className: "mt-4", disabled: form.tiers.length >= MAX_TIERS, onClick: add, children: [_jsx(Plus, { size: 20, weight: "regular" }), " Add tier (", form.tiers.length, "/", MAX_TIERS, ")"] })] }));
}
export function DiscountsEditor({ form, errors, patch }) {
    const set = (id, p) => patch((f) => ({ discounts: f.discounts.map((d) => (d.id === id ? { ...d, ...p } : d)) }));
    function add() {
        patch((f) => {
            let n = f.discounts.length + 1;
            while (f.discounts.some((d) => d.id === `discount-${n}`))
                n++;
            return {
                discounts: [
                    ...f.discounts,
                    {
                        id: `discount-${n}`,
                        code: '',
                        label: '',
                        kind: 'percent',
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
    return (_jsxs(Section, { title: "Discounts", intro: "Up to 20. Optional \u2014 new events start with none.", children: [_jsx("ul", { className: "divide-y divide-line border-y border-line", children: form.discounts.map((d, i) => (_jsxs("li", { className: "grid grid-cols-1 gap-3 py-4 md:grid-cols-2 xl:grid-cols-4", children: [_jsx(Field, { id: `disc-code-${d.id}`, label: `Discount ${i + 1} code (optional)`, children: _jsx("input", { id: `disc-code-${d.id}`, className: inputCls, placeholder: "e.g. EARLYBIRD10", value: d.code, onChange: (e) => set(d.id, { code: e.target.value }) }) }), _jsx(Field, { id: `disc-label-${d.id}`, label: "Label", children: _jsx("input", { id: `disc-label-${d.id}`, className: inputCls, value: d.label, onChange: (e) => set(d.id, { label: e.target.value }) }) }), _jsx(Field, { id: `disc-kind-${d.id}`, label: "Kind", children: _jsx("select", { id: `disc-kind-${d.id}`, className: inputCls, value: d.kind, onChange: (e) => set(d.id, { kind: e.target.value }), children: DISCOUNT_KINDS.map((k) => (_jsx("option", { value: k, children: k }, k))) }) }), _jsx(Field, { id: `disc-value-${d.id}`, label: "Value", hint: "Percent (0-100) for percent/group/earlybird, or a flat rupee amount for flat.", children: _jsx("input", { id: `disc-value-${d.id}`, type: "number", inputMode: "numeric", min: 0, className: `${inputCls} font-mono`, value: d.value, onChange: (e) => set(d.id, { value: e.target.value }) }) }), _jsx(Field, { id: `disc-minqty-${d.id}`, label: "Min quantity (optional)", children: _jsx("input", { id: `disc-minqty-${d.id}`, type: "number", inputMode: "numeric", min: 0, className: `${inputCls} font-mono`, value: d.minQty, onChange: (e) => set(d.id, { minQty: e.target.value }) }) }), _jsx(Field, { id: `disc-maxred-${d.id}`, label: "Max redemptions (optional)", children: _jsx("input", { id: `disc-maxred-${d.id}`, type: "number", inputMode: "numeric", min: 0, className: `${inputCls} font-mono`, value: d.maxRedemptions, onChange: (e) => set(d.id, { maxRedemptions: e.target.value }) }) }), _jsx(Field, { id: `disc-from-${d.id}`, label: "Valid from (optional)", children: _jsx("input", { id: `disc-from-${d.id}`, type: "datetime-local", className: `${inputCls} font-mono`, value: d.validFromUtc, onChange: (e) => set(d.id, { validFromUtc: e.target.value }) }) }), _jsx(Field, { id: `disc-to-${d.id}`, label: "Valid to (optional)", children: _jsx("input", { id: `disc-to-${d.id}`, type: "datetime-local", className: `${inputCls} font-mono`, value: d.validToUtc, onChange: (e) => set(d.id, { validToUtc: e.target.value }) }) }), _jsxs("div", { className: "flex items-end justify-between gap-3 xl:col-span-2", children: [_jsxs("label", { className: "flex min-h-11 items-center gap-2 text-sm font-medium text-muted", children: [_jsx("input", { type: "checkbox", checked: d.active, onChange: (e) => set(d.id, { active: e.target.checked }) }), "Active"] }), _jsx("button", { type: "button", className: iconBtn, "aria-label": `Remove ${d.label || `discount ${i + 1}`}`, onClick: () => patch((f) => ({ discounts: f.discounts.filter((x) => x.id !== d.id) })), children: _jsx(Trash, { size: 20, weight: "regular" }) })] })] }, d.id))) }), errors.discounts && (_jsx("p", { role: "alert", className: "mt-3 text-sm text-accent-text", children: errors.discounts })), _jsxs(Button, { variant: "secondary", className: "mt-4", disabled: form.discounts.length >= MAX_DISCOUNTS, onClick: add, children: [_jsx(Plus, { size: 20, weight: "regular" }), " Add discount (", form.discounts.length, "/", MAX_DISCOUNTS, ")"] })] }));
}
