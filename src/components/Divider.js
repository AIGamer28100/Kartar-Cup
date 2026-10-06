import { jsx as _jsx } from "react/jsx-runtime";
export default function Divider({ className = '' }) {
    return _jsx("hr", { className: `border-0 border-t border-line ${className}` });
}
