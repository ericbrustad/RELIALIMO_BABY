// Shared driver field definitions derived from the My Office drivers page UI.
// These definitions power schema generation tools and allow other modules to
// keep a single source of truth for available driver fields.

export const driverTableFieldList = [
  { column: 'organization_id', type: 'uuid', label: 'Organization' },
  { column: 'first_name', type: 'text', label: 'First Name' },
  { column: 'last_name', type: 'text', label: 'Last Name' },
  { column: 'primary_address', type: 'text', label: 'Primary Address' },
  { column: 'address_line2', type: 'text', label: 'Address Line 2' },
  { column: 'city', type: 'text', label: 'City' },
  { column: 'state', type: 'text', label: 'State / Province' },
  { column: 'postal_code', type: 'text', label: 'Postal Code' },
  { column: 'country', type: 'text', label: 'Country', default: "'US'" },
  { column: 'cell_phone', type: 'text', label: 'Cellular Phone' },
  { column: 'cell_phone_provider', type: 'text', label: 'Cellular Provider' },
  { column: 'home_phone', type: 'text', label: 'Home Phone' },
  { column: 'fax', type: 'text', label: 'Fax' },
  { column: 'other_phone', type: 'text', label: 'Pager / Other Phone' },
  { column: 'other_phone_provider', type: 'text', label: 'Pager / Other Provider' },
  { column: 'pager_phone', type: 'text', label: 'Pager Phone' },
  { column: 'pager_provider', type: 'text', label: 'Pager Provider' },
  { column: 'email', type: 'text', label: 'Email Address' },
  { column: 'notify_email', type: 'boolean', label: 'Notify by Email', default: 'false' },
  { column: 'notify_fax', type: 'boolean', label: 'Notify by Fax', default: 'false' },
  { column: 'notify_sms', type: 'boolean', label: 'Notify by SMS', default: 'false' },
  { column: 'include_phone_1', type: 'text', label: 'Include Phone Slot 1' },
  { column: 'include_phone_2', type: 'text', label: 'Include Phone Slot 2' },
  { column: 'include_phone_3', type: 'text', label: 'Include Phone Slot 3' },
  { column: 'suppress_auto_notifications', type: 'boolean', label: "Don't Send Auto Notifications", default: 'false' },
  { column: 'show_call_email_dispatch', type: 'boolean', label: 'Show Call And Email On Dispatch', default: 'false' },
  { column: 'quick_edit_dispatch', type: 'boolean', label: 'Quick Edit Driver Info On Dispatch', default: 'false' },
  { column: 'include_phone_home', type: 'boolean', label: 'Include Home Phone on Trip Sheets', default: 'false' },
  { column: 'include_phone_cell', type: 'boolean', label: 'Include Cell Phone on Trip Sheets', default: 'false' },
  { column: 'include_phone_other', type: 'boolean', label: 'Include Other Phone on Trip Sheets', default: 'false' },
  { column: 'driver_level', type: 'text', label: 'Driver Level (1-10)', default: "'5'" },
  { column: 'is_vip', type: 'boolean', label: 'VIP Flag', default: 'false' },
  { column: 'driver_alias', type: 'text', label: 'Driver Alias' },
  { column: 'driver_group', type: 'text', label: 'Driver Group' },
  { column: 'assigned_vehicle_id', type: 'uuid', label: 'Assigned Vehicle' },
  { column: 'ssn', type: 'text', label: 'Social Security Number' },
  { column: 'dob', type: 'date', label: 'Date of Birth' },
  { column: 'hire_date', type: 'date', label: 'Hire Date' },
  { column: 'termination_date', type: 'date', label: 'Termination Date' },
  { column: 'license_number', type: 'text', label: "Driver's License" },
  { column: 'license_state', type: 'text', label: 'Driver License State' },
  { column: 'license_exp_date', type: 'date', label: 'Driver License Expiration' },
  { column: 'badge_id', type: 'text', label: 'Badge / Other ID' },
  { column: 'badge_exp_date', type: 'date', label: 'Badge Expiration' },
  { column: 'tlc_license_number', type: 'text', label: 'TLC License Number' },
  { column: 'tlc_license_exp_date', type: 'date', label: 'TLC License Expiration' },
  { column: 'payroll_id', type: 'text', label: 'Driver Payroll ID' },
  { column: 'type', type: 'text', label: 'Driver Type', default: "'Driver'" },
  { column: 'status', type: 'text', label: 'Status', default: "'ACTIVE'" },
  { column: 'driver_rating', type: 'integer', label: 'Driver Rating (1-10)', default: '5' },
  { column: 'availability_status', type: 'text', label: 'Availability Status', default: "'available'" },
  { column: 'service_areas', type: 'jsonb', label: 'Service Areas', default: "'[]'::jsonb" },
  { column: 'preferred_vehicle_types', type: 'jsonb', label: 'Preferred Vehicle Types', default: "'[]'::jsonb" },
  { column: 'affiliate_id', type: 'uuid', label: 'Affiliate Company' },
  { column: 'last_farmout_offer_at', type: 'timestamptz', label: 'Last Farmout Offer' },
  { column: 'web_access', type: 'text', label: 'Web Access' },
  { column: 'web_username', type: 'text', label: 'Web Username' },
  { column: 'web_password', type: 'text', label: 'Web Password' },
  { column: 'dispatch_display_name', type: 'text', label: 'Dispatch Display Name' },
  { column: 'trip_sheets_display_name', type: 'text', label: 'Trip Sheets Display Name' },
  { column: 'driver_notes', type: 'text', label: 'Driver Notes' },
  { column: 'voucher_fee', type: 'numeric', label: 'Voucher Fee' },
  { column: 'extra_nv_1', type: 'text', label: 'Extra Field NV1' },
  { column: 'extra_nv_2', type: 'text', label: 'Extra Field NV2' },
  { column: 'extra_nv_3', type: 'text', label: 'Extra Field NV3' },
  { column: 'extra_fl_1', type: 'text', label: 'Extra Field FL1' },
  { column: 'extra_fl_2', type: 'text', label: 'Extra Field FL2' },
  { column: 'extra_fl_3', type: 'text', label: 'Extra Field FL3' },
  { column: 'created_at', type: 'timestamptz', label: 'Created At', default: 'now()' },
  { column: 'updated_at', type: 'timestamptz', label: 'Updated At', default: 'now()' }
];

export const driverPayRateFields = [
  { column: 'trip_regular_rate', type: 'numeric', label: 'Trip Hourly Regular' },
  { column: 'trip_overtime_rate', type: 'numeric', label: 'Trip Hourly Overtime' },
  { column: 'trip_double_time_rate', type: 'numeric', label: 'Trip Hourly Double' },
  { column: 'travel_regular_rate', type: 'numeric', label: 'Travel Hourly Regular' },
  { column: 'travel_overtime_rate', type: 'numeric', label: 'Travel Hourly Overtime' },
  { column: 'travel_double_time_rate', type: 'numeric', label: 'Travel Hourly Double' },
  { column: 'passenger_regular_rate', type: 'numeric', label: 'Passenger Hourly Regular' },
  { column: 'passenger_overtime_rate', type: 'numeric', label: 'Passenger Hourly Overtime' },
  { column: 'passenger_double_time_rate', type: 'numeric', label: 'Passenger Hourly Double' }
];

export const driverScheduleFields = [
  { column: 'day_of_week', type: 'text', label: 'Day of Week' },
  { column: 'start_time', type: 'time', label: 'Start Time' },
  { column: 'end_time', type: 'time', label: 'End Time' },
  { column: 'is_active', type: 'boolean', label: 'Is Active', default: 'false' }
];

export function buildAlterTableSql(tableName, fields) {
  return fields
    .filter((field) => field.column !== 'id')
    .map((field) => {
      const defaultClause = field.default ? ` DEFAULT ${field.default}` : '';
      return `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${field.column} ${field.type}${defaultClause};`;
    })
    .join('\n');
}

export function getDriverSchemaSummary() {
  return {
    drivers: driverTableFieldList.map(({ column, label }) => ({ column, label })),
    driver_pay_rates: driverPayRateFields.map(({ column, label }) => ({ column, label })),
    driver_schedules: driverScheduleFields.map(({ column, label }) => ({ column, label }))
  };
}
