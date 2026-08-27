#!/usr/bin/env bash
set -euo pipefail

# --- Determine project root (same logic) ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/../pubspec.yaml" ]]; then
    ROOT_DIR="$SCRIPT_DIR/.."
elif [[ -f "$SCRIPT_DIR/pubspec.yaml" ]]; then
    ROOT_DIR="$SCRIPT_DIR"
else
    ROOT_DIR="."
fi
ROOT_DIR="$(cd "$ROOT_DIR" && pwd)"   # resolve to absolute path

TARGET_DIR="$ROOT_DIR/lib"
OUTPUT_FILE="$ROOT_DIR/aggregated_codebase.txt"

# --- List of files (unchanged) ---
FILES_TO_EXTRACT=(
    # Core navigation
    "main.dart"
    "core/navigation/app_router.dart"

    # Sales module
    "features/sales/screens/pos_screen.dart"
    "features/sales/screens/checkout_dialog.dart"
    "features/sales/services/sales_service.dart"

    # Inventory module
    "features/inventory/screens/inventory_screen.dart"
    "features/inventory/screens/product_list_screen.dart"
    "features/inventory/screens/product_form_screen.dart"
    "features/inventory/screens/stock_movements_screen.dart"
    "features/inventory/screens/purchases/purchase_order_list_screen.dart"
    "features/inventory/screens/purchase_entry_screen.dart"
    "features/inventory/screens/purchases/receive_purchase_screen.dart"
    "features/inventory/screens/stock_adjustment_screen.dart"

    # Customers module
    "features/customers/screens/customer_list_screen.dart"
    "features/customers/screens/customer_form_dialog.dart"

    # Suppliers & Payables
    "features/payables/screens/supplier_list_screen.dart"
    "features/payables/screens/supplier_form_screen.dart"
    "features/payables/screens/payables_list_screen.dart"
    "features/payables/services/payables_service.dart"

    # Accounting & Reports
    "features/reports/screens/reports_screen.dart"
    "features/reports/screens/financial_statements_screen.dart"
    "domain/services/accounting_service.dart"

    # Settings & User Management
    "features/settings/screens/settings_screen.dart"
    "features/settings/screens/accounting_settings_screen.dart"
    "features/user_management/screens/user_list_screen.dart"
    "features/user_management/screens/user_form_screen.dart"

    # Subscription & Onboarding
    "features/onboarding/screens/onboarding_screen.dart"
    "features/auth/screens/pin_entry_screen.dart"
    "features/auth/screens/force_pin_change_screen.dart"
    "features/auth/screens/user_selection_screen.dart"

    # Shared widgets / layout
    "core/widgets/branded_scaffold.dart"
    "core/widgets/spectral_button.dart"
    "features/home/screens/home_screen.dart"
)


# --- Check write permission early ---
OUTPUT_DIR="$(dirname "$OUTPUT_FILE")"
if [[ ! -w "$OUTPUT_DIR" ]]; then
    echo "ERROR: Cannot write to $OUTPUT_DIR" >&2
    exit 1
fi

# --- Create/truncate output file ---
: > "$OUTPUT_FILE"
chmod 600 "$OUTPUT_FILE"

# --- Process files ---
for REL_PATH in "${FILES_TO_EXTRACT[@]}"; do
    FULL_PATH="${TARGET_DIR}/${REL_PATH}"
    if [[ ! -f "$FULL_PATH" ]]; then
        echo "⚠️  Warning: $FULL_PATH does not exist. Skipping." >&2
        continue
    fi

    echo "Processing: $FULL_PATH" >&2

    # Write header and content, abort if any write fails
    {
        echo "----------------------------------------------------------------"
        echo "FILE: $(basename "$FULL_PATH")"
        echo "PATH: $FULL_PATH"
        echo "----------------------------------------------------------------"
        cat "$FULL_PATH"
        echo
    } >> "$OUTPUT_FILE" || {
        echo "ERROR: Failed to write to $OUTPUT_FILE" >&2
        exit 1
    }
done

# --- Final verification ---
if [[ ! -s "$OUTPUT_FILE" ]]; then
    echo "ERROR: Output file $OUTPUT_FILE is empty!" >&2
    exit 1
fi

echo "✅ Aggregation complete → $OUTPUT_FILE ($(wc -l < "$OUTPUT_FILE") lines, $(stat -c%s "$OUTPUT_FILE") bytes)"