# BSS

## Adding and Removing of Basic and Additional Services on a Number

List of basic and additional services: GPRS, telephony, IDD and International roaming, voice, sms and data bundles, postpaid data limit.

### Steps to add on a prepaid line

1. Enter and query customer's number on order entry (individual portal).
2. Navigate to operations (found at the end of the column with phone number) and click the button for a dropdown menu.
3. Scroll down and select **modify offer**.
4. Click on the **add** button (under select offer) and search for the desired service, e.g. GPRS (for bundles, if D.A. already exists, click the copy icon after the name of the bundle).
5. Click on the check box to mark the service and click **okay** to confirm selection of service.
6. On order reason (under order information), select the drop-down and select **other reason**.
7. Put the ticket ID or remarks of your order.
8. Click on **next** to process your order.
9. Check the box to confirm customer's order and click **next** to complete order.
10. For bundles, click on **waver**, then **waver with a 100 percent discount**, put remarks and click **okay** to waiver, then lastly hit **next** to process order.

### Steps to deactivate

1. Enter and query customer's number on order entry (individual portal).
2. Navigate to operations (found at the end of the column with phone number) and click the button for a dropdown menu.
3. Scroll down and select **modify offer**.
4. Click the delete icon at the end of the row on queried service.
5. On order reason (under order information), select the drop-down and select **other reason**.
6. Put the ticket ID or remarks of your order.
7. Click on **next** to process your order.
8. Check the box to confirm customer's order and click **next** to complete order.

---

## SIM Card Replacement

Steps of doing a SIM replacement on order entry individual portal:

1. Switch to Econet back-office portal.
2. If it's a normal card, authenticate SIM card first.
3. Enter and query customer's number on order entry (individual portal).
4. Navigate to operations (found at the end of the column with phone number) and click the button for a dropdown menu.
5. Click on **sim replacement**.
6. Enter SIM card number / ICCID.
7. On order reason (under order information), select the drop-down and select **other reason**.
8. Put the ticket ID or remarks of your order.
9. Check the box to confirm customer's order and click **next** to complete order.
10. Click on **next** to process your order.

---

## Balance Adjustment, Adding a New Account / D.A. and Bundle Conversion

### Steps for balance adjustment

1. Enter and query customer's number on account receivable.
2. Identify queried balance / account and click on **Adjust**.
3. Enter number of units, select the unit of measurement, input remarks / ticket ID, or change the window period, then select **ok** to confirm adjustment.

### Steps for adding a new account / new DA

1. Enter and query customer's number on account receivable.
2. Select **add account balance**.
3. Select dropdown menu on account balance type to pick queried account type.
4. Add balance (a number, e.g. 11) and select unit of measurement for specified account type.
5. Select effective date and expiry date to determine window period.
6. Select dropdown to select service number (suggested).
7. Press **okay** to create and complete order.

### Steps for bundle conversion

1. Enter and query customer's number on account receivable.
2. Identify queried balance / account and click on **Adjust**.
3. Enter number of units, select the unit of measurement, input remarks / ticket ID, or change the window period, then select **ok** to confirm adjustment.
4. Select the correct currency and do adjustment (see balance adjustment steps).

---

## One-Way Block or Two-Way Block Activation and Deactivation

(Suspension under request and SIM card lost)

### Steps for activation

1. Enter and query customer's number on order entry (individual portal).
2. Navigate to operations (found at the end of the column with phone number) and click the button for a dropdown menu.
3. Scroll down and select either **suspension under request** or **sim card lost**.
4. On order reason (under order information), select the drop-down and select **order reason**.
5. Put the ticket ID or remarks of your order.
6. Click on **next** to process your order.
7. Check the box to confirm customer's order and click **next** to complete order.

### Steps for deactivation

1. Enter and query customer's number on order entry (individual portal).
2. Navigate to operations (found at the end of the column with phone number) and click the button for a dropdown menu.
3. Scroll down and select **reactivation** or **restore**.
4. On order reason (under order information), select the drop-down and select **order reason**.
5. Put the ticket ID or remarks of your order.
6. Click on **next** to process your order.
7. Check the box to confirm customer's order and click **next** to complete order.

---

## Checking for Basic and Additional Services on a Number

### Steps

1. Enter and query customer's number on order entry (individual portal).
2. Click on the queried phone number.
3. Scroll down and select on additional services to identify the service being queried.

---

## Checking for Complete and Hanging Orders

### Steps

1. Enter and query customer's number on order entry (individual portal).
2. Click on **Order** to view the orders.
3. Click on **detail** to view detailed order information.

---

## Line Reconnection

### Steps for reconnection

1. Switch to Econet back-office portal.
2. Enter and query customer's number on order entry (individual portal).
3. Compare the shared ICCID, ID number and customer's full name and proceed if details are matching.
4. Open system menu, expand **Sales Inventory Center** and click on **SIM Card Lifecycle**.
5. Enter ICCID on the FROM section then click the TO tab to auto-populate the ICCID and query.
6. Check the results: if SIM is in disabled state, tick the box and click on **recycle** then click **ok** to complete order; if state is available, then escalate to billing so that state can be changed to inactive.
7. Open system menu, expand **Sales Inventory Center** and click on **SIM Card binding / unbinding**.
8. Enter the phone number on FROM and TO boxes, then click on **Service Number Quantity**.
9. Enter the ICCID on FROM and TO boxes, then click on **Service Number Quantity**.
10. Click on **Query** to load information.
11. Click on **Bind** to bind the ICCID and the phone number.
12. Enter and query customer's number on order entry (individual portal).
13. Click on the house-like icon.
14. Select service class and order.
15. Input ICCID and remarks then click on **next**.
16. Check the box to confirm customer's order and click **next** to complete order, and the number will go in an inactive state.
17. On Order Entry, navigate to operations (found at the end of the column with phone number) and click the button for a dropdown menu.
18. Click on **PPS first dial**, click on **next**, and confirm order to activate SIM card.
19. Authenticate SIM card so that it will be able to attach to network.

---

# Basic Troubleshooting

## Hanging Orders / Incomplete Orders

(Basic service provisioning, SIM replacement, bundles, one-way or two-way block)

### Steps for hanging order for SIM replacement

1. Enter and query customer's number on order entry (individual portal).
2. Click on **Order** to view the order and state.
3. Open system menu, expand the **Provisioning** tab, then open **Dispatch Order Query**.
4. Enter service number starting with prefix (263), then click on **query**.
5. Copy the dispatch order.
6. Open system menu, expand the **Provisioning** tab, then click on **Online Work Order Query**.
7. Select the **Abnormal Work Order** tab, then enter the dispatch order ID of your hanging order and click **query**.
8. Double click on the order to see check-out remarks (why the order couldn't complete).
9. If there is no authentication, then authenticate card on HLR, then come back to Abnormal Work Order Query, tick your order then click on **redo** to complete order, then check again if order has been pushed.
10. If there is a change over already initiated, then use the HGIRI command on HLR, then come back to Abnormal Work Order Query, tick your order then click on **redo** to complete order, then check again if order has been pushed.
11. If there is IMSI Already Initiated or any other errors, check if order has gone through HLR, then use the **Check in** button under Abnormal Order Query.

---

## Failing to Roam

### Steps

1. Check if customer is provisioned for roaming on cvBS.
2. Check if customer has the correct roaming parameters (RSA) on HLR:
   - RSA 2 — Prepaid FULL Roaming
   - RSA 6 — Prepaid Voice and SMS
   - RSA 5 — Postpaid Voice and SMS
   - RSA 4 — Postpaid FULL Roaming
3. Check if network addresses are not blocked or restricted (VLR, SGSN); do a reset if they are restricted.
4. Check the country they are in, if we have roaming partners.
5. Check the country if it requires LTE roaming activation.
6. If LTE roaming is active, verify if all parameters are correct.
7. Advise customer to lock in to 4G, then try manual selection of network.
8. Lastly escalate to roaming team — might be an issue with the partner.

---

## Failing to Access USSD Codes

### Steps

1. Check if number is active (no one-way or two-way block).
2. Check on HLR if number has no OBSSM; remove using command with SUD if available.
3. Advise customer to use a different device to check if it's not handset related.
4. Advise customer to do a SIM replacement and see if issue can be resolved.
5. Escalate to VAS to check for possible blacklists (in most cases, if there is no OBSSM, it's a device or SIM card issue).

---

## Failing to Buy Bundles

### Steps

*(No steps were provided for this section in the source document.)*
