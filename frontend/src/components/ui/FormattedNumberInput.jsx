import React, { useRef, useLayoutEffect, useEffect } from "react";

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function FormattedNumberInput({ value, onChange, className, ...props }) {
    const inputRef = useRef(null);
    const cursorRef = useRef(null);

    const formatNumber = (val) => {
        if (val == null || val === "") return "";
        const str = String(val);
        const isNegative = str.startsWith("-");
        const absStr = isNegative ? str.slice(1) : str;

        const parts = absStr.split(".");
        let intPart = parts[0];
        const decPart = parts.length > 1 ? "." + parts.slice(1).join("") : "";

        intPart = intPart.replace(/\D/g, "");
        if (intPart === "") {
        } else {
            intPart = BigInt(intPart).toLocaleString("en-US");
        }

        return (isNegative ? "-" : "") + intPart + decPart;
    };

    const formattedValue = formatNumber(value);

    const restoreCursor = () => {
        if (cursorRef.current !== null && inputRef.current) {
            const currentFormatted = inputRef.current.value;
            const currentRaw = currentFormatted.replace(/,/g, "");
            
            let targetOffset = cursorRef.current.rawOffset;
            
            // If the parent component rejected or modified the input (e.g. decimal precision limit),
            // currentRaw won't match expectedRaw. We must fall back to the previous cursor position.
            if (currentRaw !== cursorRef.current.expectedRaw) {
                targetOffset = cursorRef.current.fallbackRawOffset;
            }

            // Bound the offset to prevent out-of-range errors
            targetOffset = Math.min(targetOffset, currentRaw.length);

            let newPos = 0;
            let rawCount = 0;
            for (let i = 0; i <= currentFormatted.length; i++) {
                if (rawCount === targetOffset) {
                    newPos = i;
                    break;
                }
                if (i < currentFormatted.length && currentFormatted[i] !== ",") {
                    rawCount++;
                }
            }
            
            inputRef.current.setSelectionRange(newPos, newPos);
            cursorRef.current = null;
        }
    };

    const handleChange = (e) => {
        const el = e.target;
        const newFormatted = el.value;
        const selectionStart = el.selectionStart;

        let raw = newFormatted.replace(/,/g, "");

        const beforeCursorNew = newFormatted.substring(0, selectionStart);
        const rawOffsetNew = beforeCursorNew.replace(/,/g, "").length;

        const oldRaw = formattedValue.replace(/,/g, "");
        const lengthDiff = raw.length - oldRaw.length;
        const fallbackRawOffset = Math.max(0, rawOffsetNew - lengthDiff);

        cursorRef.current = { 
            rawOffset: rawOffsetNew,
            fallbackRawOffset: fallbackRawOffset,
            expectedRaw: raw
        };

        if (onChange) {
            const fakeEvent = {
                ...e,
                target: {
                    value: raw,
                    name: el.name
                }
            };
            onChange(fakeEvent);
        }

        // Fallback for React forcing the DOM back without a re-render
        if (typeof window !== 'undefined') {
            requestAnimationFrame(() => {
                restoreCursor();
            });
        }
    };

    useIsoLayoutEffect(() => {
        restoreCursor();
    });

    const { type, ...restProps } = props;

    return (
        <input
            {...restProps}
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={formattedValue}
            onChange={handleChange}
            className={className}
        />
    );
}

export default FormattedNumberInput;
