import { jsx as _jsx } from "react/jsx-runtime";
const VARIANTS = {
    primary: 'bg-accent text-accent-ink hover:brightness-110',
    secondary: 'bg-raised text-ink border border-line hover:border-muted',
    ghost: 'bg-transparent text-muted hover:text-ink',
};
export const buttonCls = (variant = 'primary', className = '') => `inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-5 text-[1rem] font-medium transition duration-150 active:translate-y-px active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${VARIANTS[variant]} ${className}`;
export default function Button({ variant = 'primary', className = '', type = 'button', ...rest }) {
    return (_jsx("button", { type: type, className: buttonCls(variant, className), ...rest }));
}
