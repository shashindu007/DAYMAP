import React, { useEffect } from 'react';
import './ConfirmDialog.css';

/**
 * The app's one confirmation surface. Lifted out of Routines, which was the
 * only page with a designed confirm — Tasks was still on window.confirm.
 *
 * @param {String}   title       heading, phrased as the question
 * @param {String}   description what will actually happen
 * @param {String}   confirmLabel
 * @param {Boolean}  busy        disables both buttons and shows pending copy
 * @param {Function} onConfirm
 * @param {Function} onCancel
 */
const ConfirmDialog = ({
    title,
    description,
    confirmLabel = 'Delete',
    busyLabel = 'Deleting...',
    busy = false,
    onConfirm,
    onCancel
}) => {
    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.key === 'Escape' && !busy) onCancel();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [busy, onCancel]);

    return (
        <div
            className="confirm-overlay"
            role="presentation"
            onClick={() => !busy && onCancel()}
        >
            <div
                className="confirm-dialog card"
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirm-dialog-title"
                onClick={(event) => event.stopPropagation()}
            >
                <h3 id="confirm-dialog-title">{title}</h3>
                {description && <p>{description}</p>}
                <div className="confirm-dialog-actions">
                    <button
                        className="btn btn-outline"
                        type="button"
                        onClick={onCancel}
                        disabled={busy}
                    >
                        Cancel
                    </button>
                    <button
                        className="btn btn-danger"
                        type="button"
                        onClick={onConfirm}
                        disabled={busy}
                    >
                        {busy ? busyLabel : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
