// All available trip tags organized by category
const tripTags = [
    // Company Tags
    { tag: '#COMP_URL#', description: 'Company Website URL', category: 'company' },
    { tag: '#COMP_LOGO#', description: 'Company Logo', category: 'company' },
    { tag: '#COMP_NAME#', description: 'Company Name', category: 'company' },
    { tag: '#COMP_ADDR1#', description: 'Street Address Line1', category: 'company' },
    { tag: '#COMP_ADDR2#', description: 'Street Address Line2', category: 'company' },
    { tag: '#COMP_CITY#', description: 'Company City/Town', category: 'company' },
    { tag: '#COMP_STATEPROV#', description: 'Company State/Province/Territory', category: 'company' },
    { tag: '#COMP_ZIPPOST#', description: 'Company Zip/Postal Code', category: 'company' },
    { tag: '#COMP_COUNTRY#', description: 'Company Country', category: 'company' },
    { tag: '#COMP_PHONE1#', description: 'Company Primary Phone Number', category: 'company' },
    { tag: '#COMP_PHONE2#', description: 'Company Secondary Phone Number', category: 'company' },
    { tag: '#COMP_FAX#', description: 'Company Fax Number', category: 'company' },
    { tag: '#COMP_GENEMAIL#', description: 'Company General Email Address', category: 'company' },
    { tag: '#COMP_RESEMAIL#', description: 'Company Reservations Email Address', category: 'company' },
    { tag: '#COMP_QUOTEEMAIL#', description: 'Company Quote Email Address', category: 'company' },
    { tag: '#COMP_EIN_BUSINESS_NUMBER#', description: 'Company EIN/Business Number', category: 'company' },
    
    // Trip Basic Info
    { tag: '#TRIP_CONFNUM#', description: 'Confirmation Number', category: 'trip-info' },
    { tag: '#TRIP_CONFNUM_PREFIX#', description: 'Confirmation Number Prefix', category: 'trip-info' },
    { tag: '#TRIP_CONFNUM_SUFFIX#', description: 'Confirmation Number suffix', category: 'trip-info' },
    { tag: '#TRIP_TYPE#', description: 'Trip Type', category: 'trip-info' },
    { tag: '#TRIP_TIME_ZONE#', description: 'Time Zone', category: 'trip-info' },
    { tag: '#TRIP_PUDATE#', description: 'Pick-up Date', category: 'trip-info' },
    { tag: '#TRIP_PUTIME#', description: 'Pick-up Time', category: 'trip-info' },
    { tag: '#TRIP_DOTIME#', description: 'Drop-off Time', category: 'trip-info' },
    { tag: '#TRIP_SPOTTIME#', description: 'Spot Time', category: 'trip-info' },
    { tag: '#TRIP_GARAGETIMEOUT#', description: 'Garage-Out Time', category: 'trip-info' },
    { tag: '#TRIP_GARAGETIMEIN#', description: 'Garage-In Time', category: 'trip-info' },
    { tag: '#TRIP_ONDUTYTIME#', description: 'On Duty Time', category: 'trip-info' },
    { tag: '#TRIP_OFFDUTYTIME#', description: 'Off Duty Time', category: 'trip-info' },
    { tag: '#TRIP_DISPATCHTIME#', description: 'Time Dispatched', category: 'trip-info' },
    { tag: '#TRIP_ETAONLOCATION#', description: 'ETA On Location', category: 'trip-info' },
    { tag: '#TRIP_INCARTIME#', description: 'In car time', category: 'trip-info' },
    { tag: '#TRIP_PUDAYNAME#', description: 'Pick-up Day Name', category: 'trip-info' },
    { tag: '#TRIP_SVCTYPECODE#', description: 'Service Type Code', category: 'trip-info' },
    { tag: '#TRIP_SVCTYPENAME#', description: 'Service Type Name', category: 'trip-info' },
    { tag: '#TRIP_BOOKEDDATETIME#', description: 'Booked Date Time', category: 'trip-info' },
    { tag: '#TRIP_BOOKEDBYUSER#', description: 'Booked By Username', category: 'trip-info' },
    { tag: '#TRIP_ARRANGEDBY#', description: 'Arranged By', category: 'trip-info' },
    { tag: '#TRIP_CLIENTREFNUMBER#', description: 'Client Ref Number', category: 'trip-info' },
    { tag: '#TRIP_OCCASION#', description: 'Occasion', category: 'trip-info' },
    { tag: '#TRIP_GROUP#', description: 'Group', category: 'trip-info' },
    { tag: '#TRIP_STATUS#', description: 'Trip Status', category: 'trip-info' },
    { tag: '#TRIP_REFSOURCE#', description: 'Ref Sourse', category: 'trip-info' },
    { tag: '#TRIP_DURATION#', description: 'Trip Duration', category: 'trip-info' },
    { tag: '#TRIP_CHILDSEATINFO#', description: 'Child Seat Info', category: 'trip-info' },
    { tag: '#TRIP_HANDICAP#', description: 'Accessible', category: 'trip-info' },
    { tag: '#TRIP_LUGCOUNT#', description: 'Luggage Count', category: 'trip-info' },
    { tag: '#TRIP_PASSCOUNT#', description: 'Passengers Count', category: 'trip-info' },
    { tag: '#TRIP_PASSLIST#', description: 'List Of Passengers', category: 'trip-info' },
    { tag: '#TRIP_ALTCONTACT#', description: 'Alternate Contact', category: 'trip-info' },
    { tag: '#TRIP_ALCONTACTPH#', description: 'Alternate Contact Phone Number', category: 'trip-info' },
    { tag: '#TRIP_VOUCHER_NUMBER#', description: 'Trip Voucher Number', category: 'trip-info' },
    { tag: '#TRIP_LASTMOD_DATETIME#', description: 'Trip Last Modifications Timestamp', category: 'trip-info' },
    { tag: '#TRIP_LINKEDTRIPINFO#', description: 'Linked Trip Info', category: 'trip-info' },
    { tag: '#TRIP_GREETING_SIGN_REQUIRED#', description: 'Trip Greeting Sign Required', category: 'trip-info' },
    { tag: '#TRIP_GREETING_SIGN_NOTES#', description: 'Trip Greeting Sign Notes', category: 'trip-info' },
    { tag: '#TRIP_PUTIME_ZULU#', description: 'ZULU Trip PUTime', category: 'trip-info' },
    { tag: '#TRIP_DOTIME_ZULU#', description: 'ZULU Trip DOTime', category: 'trip-info' },
    
    // Time Labels
    { tag: '#PU_LABEL_TIME_SHORT#', description: 'PU Label Time short', category: 'time-labels' },
    { tag: '#PU_LABEL_TIME_LONG#', description: 'PU Label Time long', category: 'time-labels' },
    { tag: '#DO_LABEL_TIME_SHORT#', description: 'DO Label Time short', category: 'time-labels' },
    { tag: '#DO_LABEL_TIME_LONG#', description: 'DO Label Time long', category: 'time-labels' },
    { tag: '#SPOT_LABEL_TIME_SHORT#', description: 'Spot Label Time short', category: 'time-labels' },
    { tag: '#SPOT_LABEL_TIME_LONG#', description: 'Spot Label Time long', category: 'time-labels' },
    { tag: '#ONDUTY_LABEL_TIME_SHORT#', description: 'OnDuty Label Time short', category: 'time-labels' },
    { tag: '#ONDUTY_LABEL_TIME_LONG#', description: 'OnDuty Label Time long', category: 'time-labels' },
    { tag: '#OFFDUTY_LABEL_TIME_SHORT#', description: 'OffDuty Label Time short', category: 'time-labels' },
    { tag: '#OFFDUTY_LABEL_TIME_LONG#', description: 'OffDuty Label Time long', category: 'time-labels' },
    { tag: '#DISPATCH_LABEL_TIME_SHORT#', description: 'Dispatch Label Time short', category: 'time-labels' },
    { tag: '#DISPATCH_LABEL_TIME_LONG#', description: 'Dispatch Label Time long', category: 'time-labels' },
    { tag: '#ETA_LABEL_TIME_SHORT#', description: 'ETA Label Time short', category: 'time-labels' },
    { tag: '#ETA_LABEL_TIME_LONG#', description: 'ETA Label Time long', category: 'time-labels' },
    { tag: '#INCAR_LABEL_TIME_SHORT#', description: 'InCar Label Time short', category: 'time-labels' },
    { tag: '#INCAR_LABEL_TIME_LONG#', description: 'InCar Label Time long', category: 'time-labels' },
    { tag: '#GARAGETIMEIN_LABEL_TIME_SHORT#', description: 'GarageTimeIn Label Time short', category: 'time-labels' },
    { tag: '#GARAGETIMEIN_LABEL_TIME_LONG#', description: 'GarageTimeIn Label Time long', category: 'time-labels' },
    { tag: '#GARAGETIMEOUT_LABEL_TIME_SHORT#', description: 'GarageTimeOut Label Time short', category: 'time-labels' },
    { tag: '#GARAGETIMEOUT_LABEL_TIME_LONG#', description: 'GarageTimeOut Label Time long', category: 'time-labels' },
    
    // Billing Contact
    { tag: '#TRIP_BC_PREFIX#', description: 'Billing Contact Prefix', category: 'billing-contact' },
    { tag: '#TRIP_BC_FNAME#', description: 'Billing Contact First Name', category: 'billing-contact' },
    { tag: '#TRIP_BC_LNAME#', description: 'Billing Contact Last Name', category: 'billing-contact' },
    { tag: '#TRIP_BC_ACCT_NUM#', description: 'Billing Contact Account Number', category: 'billing-contact' },
    { tag: '#TRIP_BC_COMPANY#', description: 'Billing Contact Company', category: 'billing-contact' },
    { tag: '#TRIP_BC_ADDR1#', description: 'Billing Contact Address Line 1', category: 'billing-contact' },
    { tag: '#TRIP_BC_ADDR2#', description: 'Billing Contact Address Line 2', category: 'billing-contact' },
    { tag: '#TRIP_BC_CITY#', description: 'Billing Contact City', category: 'billing-contact' },
    { tag: '#TRIP_BC_STATEPROV#', description: 'Billing Contact State/Prov', category: 'billing-contact' },
    { tag: '#TRIP_BC_ZIPPOST#', description: 'Billing Contact Zip/Post', category: 'billing-contact' },
    { tag: '#TRIP_BC_COUNTRY#', description: 'Billing Contact Country', category: 'billing-contact' },
    { tag: '#TRIP_BC_PHONEHOM#', description: 'Billing Contact Home Phone Number', category: 'billing-contact' },
    { tag: '#TRIP_BC_PHONEOFF#', description: 'Billing Contact Office Phone Number', category: 'billing-contact' },
    { tag: '#TRIP_BC_PHONEMOB1#', description: 'Billing Contact Mobile Phone Number 1', category: 'billing-contact' },
    { tag: '#TRIP_BC_PHONEMOB2#', description: 'Billing Contact Mobile Phone Number 2', category: 'billing-contact' },
    { tag: '#TRIP_BC_PHONEMOB3#', description: 'Billing Contact Mobile Phone Number 3', category: 'billing-contact' },
    { tag: '#TRIP_BC_FAX1#', description: 'Billing Contact Fax 1', category: 'billing-contact' },
    { tag: '#TRIP_BC_FAX2#', description: 'Billing Contact Fax 2', category: 'billing-contact' },
    { tag: '#TRIP_BC_EMAIL1#', description: 'Billing Contact Email 1', category: 'billing-contact' },
    { tag: '#TRIP_BC_EMAIL2#', description: 'Billing Contact Email 2', category: 'billing-contact' },
    { tag: '#TRIP_BC_EMPLOYEEID#', description: 'Billing Contact Employee ID', category: 'billing-contact' },
    { tag: '#TRIP_BC_LOGO#', description: 'Billing Contact Logo', category: 'billing-contact' },
    { tag: '#TRIP_BC_NOTES_PRIVATE#', description: 'Billing Contact Internal/Private Notes', category: 'billing-contact' },
    { tag: '#TRIP_BC_NOTES_TRIP#', description: 'Billing Contact Preferences/Trip Notes', category: 'billing-contact' },
    { tag: '#TRIP_BC_NOTES_DRIVER#', description: 'Billing Contact Notes for Drivers', category: 'billing-contact' },
    { tag: '#TRIP_BC_DEPARTMENT#', description: 'Billing Contact Department', category: 'billing-contact' },
    
    // Booked Contact
    { tag: '#TRIP_BKC_PREFIX#', description: 'Booked Contact Prefix', category: 'booked-contact' },
    { tag: '#TRIP_BKC_FNAME#', description: 'Booked Contact First Name', category: 'booked-contact' },
    { tag: '#TRIP_BKC_LNAME#', description: 'Booked Contact Last Name', category: 'booked-contact' },
    { tag: '#TRIP_BKC_ADDR1#', description: 'Booked Contact Address Line 1', category: 'booked-contact' },
    { tag: '#TRIP_BKC_ADDR2#', description: 'Booked Contact Address Line 2', category: 'booked-contact' },
    { tag: '#TRIP_BKC_CITY#', description: 'Booked Contact City', category: 'booked-contact' },
    { tag: '#TRIP_BKC_STATEPROV#', description: 'Booked Contact State/Prov', category: 'booked-contact' },
    { tag: '#TRIP_BKC_ZIPPOST#', description: 'Booked Contact Zip/Post', category: 'booked-contact' },
    { tag: '#TRIP_BKC_COUNTRY#', description: 'Booked Contact Country', category: 'booked-contact' },
    { tag: '#TRIP_BKC_PHONEHOM#', description: 'Booked Contact Home Phone Number', category: 'booked-contact' },
    { tag: '#TRIP_BKC_PHONEOFF#', description: 'Booked Contact Office Number', category: 'booked-contact' },
    { tag: '#TRIP_BKC_PHONEMOB#', description: 'Booked Contact Mobile Phone Number', category: 'booked-contact' },
    { tag: '#TRIP_BKC_EMAIL1#', description: 'Booked Contact Email 1', category: 'booked-contact' },
    { tag: '#TRIP_BKC_EMAIL2#', description: 'Booked Contact Email 2', category: 'booked-contact' },
    
    // Passenger
    { tag: '#TRIP_PAX_PREFIX#', description: 'Passenger Prefix', category: 'passenger' },
    { tag: '#TRIP_PASS_FNAME#', description: 'Passenger First Name', category: 'passenger' },
    { tag: '#TRIP_PASS_LNAME#', description: 'Passenger Last Name', category: 'passenger' },
    { tag: '#TRIP_PASS_COMPANY#', description: 'Passenger Company', category: 'passenger' },
    { tag: '#TRIP_PASS_PHONEHOM#', description: 'Passenger Home Phone Number', category: 'passenger' },
    { tag: '#TRIP_PASS_PHONEOFF#', description: 'Passenger Office Phone Number', category: 'passenger' },
    { tag: '#TRIP_PASS_PHONEMOB1#', description: 'Passenger Mobile Phone Number 1', category: 'passenger' },
    { tag: '#TRIP_PASS_PHONEMOB2#', description: 'Passenger Mobile Phone Number 2', category: 'passenger' },
    { tag: '#TRIP_PASS_PHONEMOB3#', description: 'Passenger Mobile Phone Number 3', category: 'passenger' },
    { tag: '#TRIP_PASS_FAX1#', description: 'Passenger Fax 1', category: 'passenger' },
    { tag: '#TRIP_PASS_FAX2#', description: 'Passenger Fax 2', category: 'passenger' },
    { tag: '#TRIP_PASS_EMAIL1#', description: 'Passenger Email 1', category: 'passenger' },
    { tag: '#TRIP_PASS_EMAIL2#', description: 'Passenger Email 2', category: 'passenger' },
    { tag: '#TRIP_PASS_LOGO#', description: 'Passenger Logo', category: 'passenger' },
    { tag: '#TRIP_PASS_ADDR1#', description: 'Passenger Address Line 1', category: 'passenger' },
    { tag: '#TRIP_PASS_ADDR2#', description: 'Passenger Address Line 2', category: 'passenger' },
    { tag: '#TRIP_PASS_CITY#', description: 'Passenger City', category: 'passenger' },
    { tag: '#TRIP_PASS_STATEPROV#', description: 'Passenger State', category: 'passenger' },
    { tag: '#TRIP_PASS_ZIPPOST#', description: 'Passenger Zip Code', category: 'passenger' },
    { tag: '#TRIP_PASS_ADD_ALL#', description: 'List Of Additional Passengers', category: 'passenger' },
    { tag: '#TRIP_PASS_NOTES_PRIVATE#', description: 'Passenger Internal/Private Notes', category: 'passenger' },
    { tag: '#TRIP_PASS_NOTES_TRIP#', description: 'Passenger Preferences/Trip Notes', category: 'passenger' },
    { tag: '#TRIP_PASS_NOTES_DRIVER#', description: 'Passenger Notes for Drivers', category: 'passenger' },
    { tag: '#TRIP_PAX_DEPARTMENT#', description: 'Passenger Department', category: 'passenger' },
    { tag: '#TRIP_PAX_PRIORITY#', description: 'Passenger Priority Level', category: 'passenger' },
    
    // Vehicle
    { tag: '#TRIP_VEHTYPE_CODE#', description: 'Vehicle Type Code', category: 'vehicle' },
    { tag: '#TRIP_VEHTYPE_DESC#', description: 'Vehicle Type Description', category: 'vehicle' },
    { tag: '#TRIP_CAR1_CODE#', description: 'Primary Car Code', category: 'vehicle' },
    { tag: '#TRIP_CAR1_DESC#', description: 'Primary Car Description', category: 'vehicle' },
    { tag: '#TRIP_CAR1_NICKNAME#', description: 'Primary Car Nickname', category: 'vehicle' },
    { tag: '#TRIP_CAR1_PLATE#', description: 'Primary Car Plate Number', category: 'vehicle' },
    { tag: '#TRIP_CAR1_CAPACITY#', description: 'Primary Car Capacity', category: 'vehicle' },
    { tag: '#TRIP_CAR1_PHONE#', description: 'Primary Car Cellular Phone', category: 'vehicle' },
    { tag: '#TRIP_CAR1_EMAIL#', description: 'Primary Car Email', category: 'vehicle' },
    { tag: '#TRIP_CAR1_RADIOID#', description: 'Primary Car Two Way Radio ID', category: 'vehicle' },
    { tag: '#TRIP_CAR1_COLOR#', description: 'Primary Car Color', category: 'vehicle' },
    { tag: '#TRIP_CAR1_NOTES#', description: 'Primary Car Notes', category: 'vehicle' },
    { tag: '#TRIP_CAR2_CODE#', description: 'Secondary Car Code', category: 'vehicle' },
    { tag: '#TRIP_CAR2_DESC#', description: 'Secondary Car Description', category: 'vehicle' },
    { tag: '#TRIP_CAR2_NICKNAME#', description: 'Secondary Car Nickname', category: 'vehicle' },
    { tag: '#TRIP_CAR2_PLATE#', description: 'Secondary Car Plate Number', category: 'vehicle' },
    { tag: '#TRIP_CAR2_CAPACITY#', description: 'Secondary Car Capacity', category: 'vehicle' },
    { tag: '#TRIP_CAR2_PHONE#', description: 'Secondary Car Celluar Phone', category: 'vehicle' },
    { tag: '#TRIP_CAR2_EMAIL#', description: 'Secondary Car Email', category: 'vehicle' },
    { tag: '#TRIP_CAR2_RADIOID#', description: 'Secondary Car Two Way Radio ID', category: 'vehicle' },
    { tag: '#TRIP_CAR2_COLOR#', description: 'Secondary Car Color', category: 'vehicle' },
    { tag: '#TRIP_CAR2_NOTES#', description: 'Secondary Car Notes', category: 'vehicle' },
    
    // Driver
    { tag: '#TRIP_DRIVER1_FNAME#', description: 'Primary Driver First Name', category: 'driver' },
    { tag: '#TRIP_DRIVER1_LNAME#', description: 'Primary Driver Last Name', category: 'driver' },
    { tag: '#TRIP_DRIVER1_ALIAS#', description: 'Primary Driver Alias', category: 'driver' },
    { tag: '#TRIP_DRIVER1_PHONEHOM#', description: 'Primary Driver Home Phone Number', category: 'driver' },
    { tag: '#TRIP_DRIVER1_PHONEMOB#', description: 'Primary Driver Mobile Phone Number', category: 'driver' },
    { tag: '#TRIP_DRIVER1_PHONEOTH#', description: 'Primary Driver Pager/Other Phone Number', category: 'driver' },
    { tag: '#TRIP_DRIVER1_EMAIL#', description: 'Primary Driver Email', category: 'driver' },
    { tag: '#TRIP_DRIVER1_LICNO#', description: 'Primary Driver License Number', category: 'driver' },
    { tag: '#TRIP_DRIVER1_PORTRAIT#', description: 'Primary Driver Portrait', category: 'driver' },
    { tag: '#TRIP_DRIVER2_FNAME#', description: 'Secondary Driver First Name', category: 'driver' },
    { tag: '#TRIP_DRIVER2_LNAME#', description: 'Secondary Driver Last Name', category: 'driver' },
    { tag: '#TRIP_DRIVER2_ALIAS#', description: 'Secondary Driver Alias', category: 'driver' },
    { tag: '#TRIP_DRIVER2_PHONEHOM#', description: 'Secondary Driver Home Phone Number', category: 'driver' },
    { tag: '#TRIP_DRIVER2_PHONEMOB#', description: 'Secondary Driver Mobile Phone Number', category: 'driver' },
    { tag: '#TRIP_DRIVER2_PHONEOTH#', description: 'Secondary Driver Pager/Other Phone Number', category: 'driver' },
    { tag: '#TRIP_DRIVER2_EMAIL#', description: 'Secondary Driver Email', category: 'driver' },
    { tag: '#TRIP_DRIVER2_LICNO#', description: 'Secondary Driver License Number', category: 'driver' },
    { tag: '#TRIP_DRIVER2_PORTRAIT#', description: 'Secondary Driver Portrait', category: 'driver' },
    
    // Notes
    { tag: '#TRIP_NOTES_MAIN#', description: 'Main Notes', category: 'notes' },
    { tag: '#TRIP_NOTES_DRIVER#', description: 'Driver Notes', category: 'notes' },
    { tag: '#TRIP_NOTES_BCPASS#', description: 'Bill To & Pax Notes', category: 'notes' },
    
    // Rates Summary
    { tag: '#TRIP_RATES_ITEMIZED#', description: 'Rates Itemized', category: 'rates-summary' },
    { tag: '#TRIP_RATES_ITEMIZED_NOHEADER#', description: 'Rates Itemized (No header)', category: 'rates-summary' },
    { tag: '#TRIP_RATES_GROUPED#', description: 'Rates Grouped', category: 'rates-summary' },
    { tag: '#TRIP_RATES_GROUPED_NOHEADER#', description: 'Rates Grouped (No header)', category: 'rates-summary' },
    { tag: '#TRIP_RATES_SUMMARY#', description: 'Rates Summary', category: 'rates-summary' },
    { tag: '#TRIP_RATES_TOTAL#', description: 'Rates Total', category: 'rates-summary' },
    { tag: '#TRIP_RATES_TOTALDUE#', description: 'Rates Total Due', category: 'rates-summary' },
    { tag: '#TRIP_RATES_VAT_TOTAL#', description: 'VAT Rates Total', category: 'rates-summary' },
    { tag: '#TRIP_RATES_NET_TOTAL#', description: 'Rates Total Minus VAT Rates', category: 'rates-summary' },
    { tag: '#TRIP_RATES_BASE_TOTAL#', description: 'Total of Base Rates Group', category: 'rates-summary' },
    { tag: '#TRIP_RATES_GRATUITIES_TOTAL#', description: 'Total of Gratuities Rates Group', category: 'rates-summary' },
    { tag: '#TRIP_RATES_TAXES_TOTAL#', description: 'Total of Taxes Rates Group', category: 'rates-summary' },
    { tag: '#TRIP_RATES_MISC_TOTAL#', description: 'Total of Miscellaneous Rates Group', category: 'rates-summary' },
    { tag: '#TRIP_RATES_SURCHARGES_TOTAL#', description: 'Sum of All Surcharge Groups', category: 'rates-summary' },
    { tag: '#TRIP_RATES_DISCOUNTS_TOTAL#', description: 'Sum of All Discounts Groups', category: 'rates-summary' },
    { tag: '#TRIP_CURRENCY_SYMBOL#', description: 'Currency Symbol', category: 'rates-summary' },
    { tag: '#TRIP_CURRENCY_ABBR#', description: 'Currency Abbreviation', category: 'rates-summary' },
    
    // Payment
    { tag: '#TRIP_PAYMENTS_NOAUTH#', description: 'Payments Without "Auth Only"', category: 'payment' },
    { tag: '#TRIP_PAYMENTS_PLUSAUTH#', description: 'Payments Plus "Auth Only"', category: 'payment' },
    { tag: '#TRIP_PAYMENTS_AUTHONLY#', description: 'Payments "Auth Only"', category: 'payment' },
    { tag: '#TRIP_PAYMENTS_LAST#', description: 'Value of most recent payment taken', category: 'payment' },
    { tag: '#TRIP_PAYMENTS_LAST_TRANSID#', description: 'Transaction ID of most recent payment taken', category: 'payment' },
    { tag: '#TRIP_PAYMENTS_REFNOS#', description: 'List of all transaction ref numbers on the trip', category: 'payment' },
    { tag: '#TRIP_PAYMENTS_REFNO_LAST#', description: 'Last transaction ref number on the trip', category: 'payment' },
    { tag: '#TRIP_PAYMENTS_ITEMIZED#', description: 'Itemized list of transactions on the trip', category: 'payment' },
    { tag: '#TRIP_PAYMETHOD#', description: 'Payment Method', category: 'payment' },
    { tag: '#TRIP_PAYMETHOD_DESC#', description: 'Payment Method Description', category: 'payment' },
    { tag: '#TRIP_CC_LASTFOUR#', description: 'Credit Card Last Four Number', category: 'payment' },
    { tag: '#TRIP_CC_EXPDATE#', description: 'Credit Card Expired Date', category: 'payment' },
    { tag: '#TRIP_CC_NAME#', description: 'Credit Card Name', category: 'payment' },
    { tag: '#TRIP_CC_STREET#', description: 'Credit Card Address', category: 'payment' },
    { tag: '#TRIP_CC_POSTCODE#', description: 'Credit Card Post Code', category: 'payment' },
    { tag: '#TRIP_PAYSTATUS#', description: 'Payment Status', category: 'payment' },
    
    // Routing
    { tag: '#TRIP_RT_ALL#', description: 'List of Trip Routing', category: 'routing' },
    { tag: '#TRIP_RT_PUBLOCK#', description: 'Trip Routing Pick-up Block', category: 'routing' },
    { tag: '#TRIP_RT_STBLOCK#', description: 'Trip Routing Stop Block', category: 'routing' },
    { tag: '#TRIP_RT_WTBLOCK#', description: 'Trip Routing Wait Block', category: 'routing' },
    { tag: '#TRIP_RT_DOBLOCK#', description: 'Trip Routing Drop-off Block', category: 'routing' },
    
    // Agreement & Terms
    { tag: '#TRIP_RENTAGR_TITLE#', description: 'Rental Agreement Title', category: 'agreement' },
    { tag: '#TRIP_RENTAGR_TEXT#', description: 'Rental Agreement Text', category: 'agreement' },
    { tag: '#TRIP_TERMS#', description: 'Trip Terms', category: 'agreement' },
    { tag: '#TRIP_TERMS_SIGNATURE#', description: 'Terms Signature', category: 'agreement' },
    { tag: '#TRIP_TERMS_SIGNATURE_DATE#', description: 'Terms Signature Date', category: 'agreement' },
    { tag: '#TRIP_PAYMENT_SIGNATURE#', description: 'Payment Signature', category: 'agreement' },
    { tag: '#TRIP_PAYMENT_SIGNATURE_DATE#', description: 'Payment Signature Date', category: 'agreement' },
    
    // Affiliate
    { tag: '#TRIP_AFF_NAME#', description: 'Trip Affiliate Name', category: 'affiliate' },
    { tag: '#TRIP_AFF_DRIVER#', description: 'Trip Affiliate Driver', category: 'affiliate' },
    { tag: '#TRIP_AFF_DRIVER_PHONE#', description: 'Trip Affiliate Driver Phone', category: 'affiliate' },
    { tag: '#TRIP_AFF_DRIVER_CAR#', description: 'Trip Affiliate Car Name', category: 'affiliate' },
    { tag: '#TRIP_AFF_DRIVER_CAR_PHONE#', description: 'Trip Affiliate Car Phone', category: 'affiliate' },
    { tag: '#TRIP_AFF_REF_NUMBER#', description: 'Trip Affiliate Reference Number', category: 'affiliate' },
    { tag: '#TRIP_AFF_RENTAGR_TITLE#', description: 'Trip Affiliate Rental Agreement Title', category: 'affiliate' },
    { tag: '#TRIP_AFF_RENTAGR_TEXT#', description: 'Trip Affiliate Rental Agreement Text', category: 'affiliate' },
    { tag: '#TRIP_AFF_RATES_ITEMIZED#', description: 'Trip Affiliate Rates Itemized', category: 'affiliate' },
    { tag: '#TRIP_AFF_RATES_ITEMIZED_NOHEADER#', description: 'Trip Affiliate Rates Itemized No Header', category: 'affiliate' },
    { tag: '#TRIP_AFF_RATES_TOTAL#', description: 'Trip Affiliate Rates Total', category: 'affiliate' },
    { tag: '#TRIP_AFF_PHONE#', description: 'Trip Affiliate Phone Number', category: 'affiliate' },
    
    // Agents
    { tag: '#TRIP_AGENT_PRIMARY#', description: 'Primary Agent(s)', category: 'agents' },
    { tag: '#TRIP_AGENT_SECONDARY#', description: 'Secondary Agent(s)', category: 'agents' },
    
    // System & App URLs
    { tag: '#NOW_DATE#', description: 'Current Date', category: 'system' },
    { tag: '#NOW_TIME#', description: 'Current Time', category: 'system' },
    { tag: '#PERSONAL_MSG#', description: 'Personal Message', category: 'system' },
    { tag: '#PASS_APP_URL#', description: 'Driver Anywhere Sign In URL', category: 'system' },
    { tag: '#PWA_SIGNIN_URL#', description: 'PWA Sign In URL', category: 'system' },
    { tag: '#PWA_APP_URL#', description: 'PWA Book a Ride URL', category: 'system' },
    { tag: '#PWA_CREATE_ACCT_URL#', description: 'PWA Create Account URL', category: 'system' },
    { tag: '#PWA_MANAGE_RIDES_URL#', description: 'PWA Manage Rides URL', category: 'system' },
    { tag: '#PWA_TRIP_DETAILS_URL#', description: 'PWA Trip Details URL', category: 'system' },
    { tag: '#PWA_TRACK_DRIVER_URL#', description: 'PWA Track Driver URL', category: 'system' },
];

let selectedTripTag = null;
let currentTripCategory = 'all';
let targetTripElement = null;
let savedSelection = null; // Store cursor position for contenteditable

// Initialize the trip tag selector
function initTripTagSelector() {
    renderTripTags(tripTags);
}

// Render trip tags in the table
function renderTripTags(tags) {
    const tbody = document.getElementById('tripTagTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    tags.forEach(tagData => {
        const row = document.createElement('tr');
        row.dataset.tag = tagData.tag;
        row.dataset.category = tagData.category;
        
        // Make row draggable
        row.draggable = true;
        row.classList.add('draggable-tag');
        
        row.innerHTML = `
            <td><span class="drag-handle">⋮⋮</span> ${tagData.tag}</td>
            <td>${tagData.description}</td>
        `;
        
        row.addEventListener('click', function() {
            selectTripTag(this, tagData.tag);
        });
        
        row.addEventListener('dblclick', function() {
            selectTripTag(this, tagData.tag);
            insertSelectedTripTag();
        });
        
        // Drag event listeners
        row.addEventListener('dragstart', function(e) {
            e.dataTransfer.setData('text/plain', tagData.tag);
            e.dataTransfer.effectAllowed = 'copy';
            row.classList.add('dragging');
        });
        
        row.addEventListener('dragend', function(e) {
            row.classList.remove('dragging');
        });
        
        tbody.appendChild(row);
    });
}

// Select a trip tag
function selectTripTag(row, tag) {
    // Remove previous selection
    document.querySelectorAll('.trip-tag-table tbody tr').forEach(tr => {
        tr.classList.remove('selected');
    });
    
    // Add selection to clicked row
    row.classList.add('selected');
    selectedTripTag = tag;
}

// Filter trip tags by search
function filterTripTags() {
    const searchTerm = document.getElementById('tripTagSearch').value.toLowerCase();
    const rows = document.querySelectorAll('.trip-tag-table tbody tr');
    
    rows.forEach(row => {
        const tag = row.cells[0].textContent.toLowerCase();
        const description = row.cells[1].textContent.toLowerCase();
        const category = row.dataset.category;
        
        const matchesSearch = tag.includes(searchTerm) || description.includes(searchTerm);
        const matchesCategory = currentTripCategory === 'all' || category === currentTripCategory;
        
        if (matchesSearch && matchesCategory) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

// Filter by trip category
function filterByTripCategory(category) {
    currentTripCategory = category;
    
    // Update active button
    document.querySelectorAll('.trip-category-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    filterTripTags();
}

// Open trip tag selector
function openTripTagSelector(targetInput) {
    // If no target provided, try to find the active/focused editor
    if (!targetInput) {
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable)) {
            targetInput = activeElement;
        }
    }
    
    targetTripElement = targetInput;
    
    // Save current selection/cursor position for contenteditable elements
    if (targetInput && targetInput.isContentEditable) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            savedSelection = selection.getRangeAt(0).cloneRange();
        }
    }
    
    const modal = document.getElementById('tripTagSelectorModal');
    modal.classList.add('active');
    
    console.log('Trip tag selector opened for:', targetInput);
    console.log('Saved selection:', savedSelection);
    
    // Focus on search input
    const searchInput = document.getElementById('tripTagSearch');
    if (searchInput) {
        searchInput.focus();
    }
}

// Close trip tag selector
function closeTripTagSelector() {
    const modal = document.getElementById('tripTagSelectorModal');
    modal.classList.remove('active');
    selectedTripTag = null;
    targetTripElement = null;
    savedSelection = null; // Clear saved selection
    
    // Reset filters
    const searchInput = document.getElementById('tripTagSearch');
    if (searchInput) {
        searchInput.value = '';
    }
    currentTripCategory = 'all';
    document.querySelectorAll('.trip-category-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const allBtn = document.querySelector('.trip-category-btn');
    if (allBtn) {
        allBtn.classList.add('active');
    }
    filterTripTags();
}

// Insert selected trip tag
function insertSelectedTripTag() {
    if (!selectedTripTag) {
        alert('Please select a trip tag to insert');
        return;
    }
    
    if (targetTripElement) {
        // Insert tag into the target element
        if (targetTripElement.tagName === 'TEXTAREA' || targetTripElement.tagName === 'INPUT') {
            const start = targetTripElement.selectionStart;
            const end = targetTripElement.selectionEnd;
            const text = targetTripElement.value;
            targetTripElement.value = text.substring(0, start) + selectedTripTag + text.substring(end);
            targetTripElement.selectionStart = targetTripElement.selectionEnd = start + selectedTripTag.length;
            targetTripElement.focus();
            
            // Trigger input event for any listeners
            targetTripElement.dispatchEvent(new Event('input', { bubbles: true }));
            
            console.log('✅ Tag inserted into textarea:', selectedTripTag);
        }
        
        // If it's a content editable or rich text editor
        else if (targetTripElement.isContentEditable) {
            targetTripElement.focus();
            
            // Restore saved selection if available
            if (savedSelection) {
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(savedSelection);
            }
            
            // Insert the tag
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                const textNode = document.createTextNode(selectedTripTag);
                range.insertNode(textNode);
                
                // Move cursor after inserted tag
                range.setStartAfter(textNode);
                range.setEndAfter(textNode);
                selection.removeAllRanges();
                selection.addRange(range);
                
                // Trigger input event
                targetTripElement.dispatchEvent(new Event('input', { bubbles: true }));
                
                console.log('✅ Tag inserted into contenteditable:', selectedTripTag);
            } else {
                // Fallback: insert at end
                targetTripElement.appendChild(document.createTextNode(selectedTripTag));
                console.log('✅ Tag appended to contenteditable (no selection):', selectedTripTag);
            }
        }
    } else {
        console.log('❌ No target element for tag insertion');
    }
    
    closeTripTagSelector();
}

// Close modal when clicking outside
document.addEventListener('click', function(e) {
    const modal = document.getElementById('tripTagSelectorModal');
    if (e.target === modal) {
        closeTripTagSelector();
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    const modal = document.getElementById('tripTagSelectorModal');
    if (modal && modal.classList.contains('active')) {
        if (e.key === 'Escape') {
            closeTripTagSelector();
        } else if (e.key === 'Enter' && selectedTripTag) {
            insertSelectedTripTag();
        }
    }
});

// Initialize on load
document.addEventListener('DOMContentLoaded', initTripTagSelector);

// Export functions for use in other files
window.openTripTagSelector = openTripTagSelector;
window.closeTripTagSelector = closeTripTagSelector;
window.insertSelectedTripTag = insertSelectedTripTag;
window.filterTripTags = filterTripTags;
window.filterByTripCategory = filterByTripCategory;
