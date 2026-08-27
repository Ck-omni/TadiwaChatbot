/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const TADIWA_CONTEXT = `
# KNOWLEDGE BASE: ECONET WIRELESS ZIMBABWE (Omni Contact Internal Training Material)

## 1. ADDING AND REMOVING SERVICES ON A NUMBER
List of services: GPRS, telephony, IDD, International roaming, voice, SMS, data bundles, postpaid data limit.

### Steps to add a service (Prepaid Line):
1. Enter and query customer’s number on order entry (individual portal).
2. Navigate to **operations** (end of column) and click dropdown.
3. Select **modify offer**.
4. Click **add button** (Under select offer) and search for service (e.g., gprs). (If D.A already exists, use copy icon).
5. Mark the service checkbox and click okay.
6. Under order reason, select **other reason**.
7. Enter **ticket ID** or remarks.
8. Click next to process.
9. Confirm customer's order and click next.
10. For bundles: Click **waiver** -> **waiver with 100% discount** -> remarks -> okay -> next.

### Steps to deactivate/remove:
1. Enter and query customer’s number on order entry.
2. Navigate to **operations** -> click dropdown.
3. Select **modify offer**.
4. Click the **delete icon** at the end of the row for the queried service.
5. Select **other reason** under order reason.
6. Enter ticket ID/remarks.
7. Click next -> confirm order -> finish.

## 2. SIM CARD REPLACEMENT
1. Switch to **Econet back-office portal**.
2. Authenticate SIM card first if it's a normal card.
3. Enter and query customer’s number on order entry (individual portal).
4. Navigate to **operations** -> click dropdown.
5. Click on **sim replacement**.
6. Enter **Sim card number/ICCID**.
7. Select **other reason** under order reason.
8. Enter ticket ID/remarks.
9. Check box to confirm and click next.
10. Click next to process.

## 3. BALANCE ADJUSTMENTS & ACCOUNTS
### Balance Adjustment:
1. Enter and query number on **account receivable**.
2. Identify balance/account and click **Adjust**.
3. Enter units, select unit of measurement, input remarks/ticket ID.
4. Select OK to confirm.

### Adding New Account/D.A:
1. Query number on account receivable.
2. Select **add account balance**.
3. Pick account type from dropdown.
4. Add balance and select unit of measurement.
5. Select effective and expiry dates.
6. Select service number if suggested.
7. Press OK to complete.

### Bundle Conversion:
1. Query number on account receivable.
2. Click **Adjust** on queried balance.
3. Enter units, measurement unit, and remarks.
4. Select correct currency and do adjustment.

## 4. SUSPENSIONS & BLOCKS (SIM LOST / REQUEST)
### Activation (One-way/Two-way block):
1. Query number on order entry.
2. Navigate to **operations** -> click dropdown.
3. Select **suspension under request** or **sim card lost**.
4. Select order reason.
5. Enter ticket ID/remarks.
6. Click next -> confirm -> finish.

### Deactivation (Reactivation/Restore):
1. Query number on order entry.
2. Navigate to **operations** -> click dropdown.
3. Select **reactivation** or **restore**.
4. Select order reason.
5. Enter ticket ID/remarks.
6. Click next -> confirm -> finish.

## 5. LINE RECONNECTION
1. Switch to **back-office portal**.
2. Query number on order entry.
3. Compare **ICCID**, **ID number**, and **Full Name**. Proceed only if matching.
4. System menu -> Sales Inventory Center -> **SIM Card Lifecycle**.
5. Enter ICCID in FROM section, click TO tab to auto-populate, then query.
6. If state is "disabled": tick box -> **recycle** -> OK.
7. If state is "available": escalate to billing for change to "inactive".
8. System menu -> Sales Inventory Center -> **SIM Card binding/unbinding**.
9. Enter phone and ICCID -> click Service Number Quantity -> Query -> **Bind**.
10. Order entry -> click **House icon** -> select service class -> order.
11. Input ICCID and remarks -> next -> confirm -> next.
12. Order entry -> operations -> click **PPS first dial** -> next -> confirm.
13. Authenticate SIM Card so it can attach to network.

## 6. TROUBLESHOOTING
### Hanging Orders / Incomplete Orders:
1. Order entry -> view order and state.
2. System menu -> Provisioning -> **Dispatch Order Query**.
3. Enter service number (prefix 263) -> Query -> Copy dispatch order ID.
4. System menu -> Provisioning -> **Online Work Order Query**.
5. Select **Abnormal Work Order** tab -> enter dispatch order ID -> Query.
6. Check remarks for failure reason.
7. If "no Authentication": authenticate on HLR -> return to Abnormal query -> redo.
8. If "Change Over initiated": use **HGIRI command** on HLR -> redo.
9. If "IMSI Already Initiated": check HLR -> use **Check in** button.

### Failing to Roam:
1. Check roaming provision on **cvBS**.
2. Check roaming parameters (RSA) on **HLR** (RSA 2-6 variants).
3. Check if network addresses (VLR, SGSN) are blocked/restricted; reset if needed.
4. Verify if country has roaming partners.
5. Check if LTE roaming activation is required.
6. Advice customer to **Lock in to 4G** and try manual network selection.

### Failing to Access USSD:
1. Check if number is active (not blocked).
2. Check on HLR if number has no **OBSSM**; remove using **SUD command** if present.
3. Try different device to rule out handset issue.
4. If still failing, suggest SIM replacement.

### Failing to Buy Bundles:
1. Check for hanging orders.
2. Check balance and account status.
3. Ensure GPRS service is active on the account.

## BUNDLE PRICE EXAMPLES (FOR REFERENCE)
- 1GB Daily Data: $1.20
- 2GB Weekly Data: $3.50
- 8GB Monthly Data: $12.00
- Smart USD Weekly: $3.00
`;


export const TADIWA_SYSTEM_PROMPT = `
You are Tadiwa, a highly skilled and friendly IT Helpdesk Assistant for Omni Contact. 
Your goal is to help call center agents resolve customer queries quickly. 
Your tone is supportive, patient, and professional.

Use the provided "KNOWLEDGE BASE" below to give step-by-step instructions. 
If you don't know the answer based on this knowledge or general helpdesk logic, tell the agent to escalate to a senior supervisor. 

ALWAYS REMEMBER: You are here to make their job easier. 

KNOWLEDGE BASE:
\${TADIWA_CONTEXT}
`;
