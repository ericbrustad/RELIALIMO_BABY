import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { supabase } from '../config/supabase';
import { useTheme } from '../context';
import { spacing, fontSize, borderRadius } from '../config/theme';
import type { RootStackParamList, RegisterUserData } from '../types';

const { width } = Dimensions.get('window');

const LOGO_URL = 'https://siumiadylwcrkaqsfwkj.supabase.co/storage/v1/object/public/images/reliabull%20limo%20logowhitecropped.png';

// Default organization ID - same as web portal
const DEFAULT_ORG_ID = '54eb6ce7-ba97-4198-8566-6ac075828160';

type RouteParams = RouteProp<RootStackParamList, 'RegisterVehicle'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

interface VehicleType {
  id: string;
  name: string;
  is_active: boolean;
}

const VEHICLE_COLORS = [
  { value: '', label: 'Select color...' },
  { value: 'Black', label: 'Black' },
  { value: 'White', label: 'White' },
  { value: 'Silver', label: 'Silver' },
  { value: 'Gray', label: 'Gray' },
  { value: 'Blue', label: 'Blue' },
  { value: 'Red', label: 'Red' },
  { value: 'Other', label: 'Other' },
];

const CAPACITIES = [
  { value: '3', label: '3 passengers' },
  { value: '4', label: '4 passengers' },
  { value: '5', label: '5 passengers' },
  { value: '6', label: '6 passengers' },
  { value: '7', label: '7 passengers' },
  { value: '8', label: '8+ passengers' },
];

// Generate portal slug like web portal
function generatePortalSlug(firstName: string, lastName: string): string {
  const first = firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const last = lastName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const timestamp = Date.now().toString(36).slice(-4);
  return `${first}_${last}_${timestamp}`;
}

// Format phone for storage
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  return digits.startsWith('1') ? `+${digits}` : `+1${digits}`;
}

export function RegisterVehicleScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteParams>();
  const { userData, companyId, affiliateId, affiliateName } = route.params;
  const { colors } = useTheme();
  
  // Create dynamic styles based on current theme
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  // Vehicle types from database
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  
  // Vehicle state
  const [vehicleTypeId, setVehicleTypeId] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleCapacity, setVehicleCapacity] = useState('4');
  
  // Permits & Insurance
  const [limoPermit, setLimoPermit] = useState('');
  const [permitExpMonth, setPermitExpMonth] = useState('');
  const [permitExpYear, setPermitExpYear] = useState('');
  const [dotNumber, setDotNumber] = useState('');
  const [insuranceCompany, setInsuranceCompany] = useState('');
  const [insurancePolicy, setInsurancePolicy] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Load vehicle types from database
  useEffect(() => {
    loadVehicleTypes();
  }, []);
  
  const loadVehicleTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicle_types')
        .select('id, name, is_active')
        .eq('is_active', true)
        .order('name');
      
      if (error) {
        console.warn('[RegisterVehicle] Error loading vehicle types:', error);
        // Fallback vehicle types
        setVehicleTypes([
          { id: 'sedan', name: 'Sedan', is_active: true },
          { id: 'suv', name: 'SUV', is_active: true },
          { id: 'van', name: 'Van', is_active: true },
          { id: 'limousine', name: 'Limousine', is_active: true },
        ]);
      } else {
        setVehicleTypes(data || []);
      }
    } catch (err) {
      console.error('[RegisterVehicle] Failed to load vehicle types:', err);
    } finally {
      setLoadingTypes(false);
    }
  };
  
  // Generate year options
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 30 }, (_, i) => ({
    value: String(currentYear - i),
    label: String(currentYear - i),
  }));
  years.unshift({ value: '', label: 'Select year...' });
  
  // Month options for permit expiration
  const months = [
    { value: '', label: 'Month...' },
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ];
  
  // Expiration years
  const expirationYears = Array.from({ length: 10 }, (_, i) => ({
    value: String(currentYear + i),
    label: String(currentYear + i),
  }));
  expirationYears.unshift({ value: '', label: 'Year...' });
  
  // Validate form
  const canSubmit = vehicleTypeId && vehiclePlate.trim();
  
  // Submit registration - matches web portal flow
  const handleSubmit = async () => {
    if (!canSubmit) {
      Alert.alert('Error', 'Please select a vehicle type and enter license plate');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Generate unique IDs
      const driverUUID = crypto.randomUUID();
      const portalSlug = generatePortalSlug(userData.firstName, userData.lastName);
      
      // Simple password hash (same as web portal for driver login)
      const passwordHash = btoa(userData.password + '_salt_' + Date.now());
      
      // Get organization ID (from affiliate or default)
      const organizationId = affiliateId ? undefined : DEFAULT_ORG_ID;
      
      // 1. Create driver record - matches web portal fields
      const driverData: Record<string, any> = {
        id: driverUUID,
        first_name: userData.firstName,
        last_name: userData.lastName,
        email: userData.email.toLowerCase(),
        cell_phone: formatPhone(userData.phone),
        status: 'ACTIVE',
        driver_status: 'available',
        type: 'FULL TIME',
        portal_slug: portalSlug,
        password_hash: passwordHash,
        driver_level: '10', // Highest priority for farmout
        availability: ['24/7 Available'],
        affiliate_id: affiliateId || null,
        affiliate_name: affiliateName || null,
      };
      
      // Only include organization_id if not using affiliate
      if (organizationId) {
        driverData.organization_id = organizationId;
      }
      
      console.log('[RegisterVehicle] Creating driver:', JSON.stringify(driverData, null, 2));
      
      const { data: newDriver, error: driverError } = await supabase
        .from('drivers')
        .insert(driverData)
        .select()
        .single();
      
      if (driverError) {
        console.error('[RegisterVehicle] Driver creation error:', driverError);
        throw new Error(driverError.message);
      }
      
      if (!newDriver) {
        throw new Error('Failed to create driver account');
      }
      
      console.log('[RegisterVehicle] ✅ Driver created:', newDriver.id);
      
      // 2. Create vehicle record - matches fleet_vehicles table
      const driverInitials = `${(userData.firstName || 'X')[0]}${(userData.lastName || 'X')[0]}`.toUpperCase();
      const timestamp = Date.now().toString(36).toUpperCase().slice(-5);
      const unitNumber = `${driverInitials}${timestamp}`;
      
      const vehicleData: Record<string, any> = {
        assigned_driver_id: newDriver.id,
        affiliate_id: affiliateId || null,
        unit_number: unitNumber,
        veh_disp_name: unitNumber,
        veh_type: vehicleTypeId,
        vehicle_type_id: vehicleTypeId,
        make: vehicleMake || null,
        model: vehicleModel || null,
        year: vehicleYear ? parseInt(vehicleYear) : null,
        color: vehicleColor || null,
        license_plate: vehiclePlate.toUpperCase(),
        passenger_capacity: parseInt(vehicleCapacity),
        capacity: parseInt(vehicleCapacity),
        status: 'AVAILABLE',
        is_active: true,
        limo_permit_number: limoPermit || null,
        permit_expiration_month: permitExpMonth ? parseInt(permitExpMonth) : null,
        permit_expiration_year: permitExpYear ? parseInt(permitExpYear) : null,
        us_dot_number: dotNumber || null,
        insurance_company: insuranceCompany || null,
        insurance_policy_number: insurancePolicy || null,
      };
      
      // Only include organization_id if not using affiliate
      if (organizationId) {
        vehicleData.organization_id = organizationId;
      }
      
      console.log('[RegisterVehicle] Creating vehicle:', JSON.stringify(vehicleData, null, 2));
      
      const { data: createdVehicle, error: vehicleError } = await supabase
        .from('fleet_vehicles')
        .insert(vehicleData)
        .select()
        .single();
      
      if (vehicleError) {
        console.error('[RegisterVehicle] Vehicle creation error:', vehicleError);
        // Don't fail registration for vehicle error - driver is created
        console.warn('[RegisterVehicle] Continuing without vehicle record');
      } else if (createdVehicle) {
        console.log('[RegisterVehicle] ✅ Vehicle created:', createdVehicle.id);
        
        // Update driver with assigned vehicle ID
        await supabase
          .from('drivers')
          .update({ assigned_vehicle_id: createdVehicle.id })
          .eq('id', newDriver.id);
      }
      
      // Navigate to welcome screen
      navigation.reset({
        index: 0,
        routes: [{
          name: 'Welcome',
          params: {
            driverName: `${userData.firstName} ${userData.lastName}`,
            driverId: newDriver.id,
            portalSlug: portalSlug,
          },
        }],
      });
    } catch (error: any) {
      console.error('[RegisterVehicle] Error:', error);
      Alert.alert('Registration Failed', error.message || 'Please try again');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Go back
  const handleBack = () => {
    navigation.goBack();
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Image
              source={{ uri: LOGO_URL }}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.tagline}>Driver Portal</Text>
          </View>
          
          {/* Step Indicator */}
          <View style={styles.stepIndicator}>
            <View style={[styles.step, styles.stepComplete]}>
              <Text style={styles.stepText}>✓</Text>
            </View>
            <View style={[styles.stepLine, styles.stepLineActive]} />
            <View style={[styles.step, styles.stepComplete]}>
              <Text style={styles.stepText}>✓</Text>
            </View>
            <View style={[styles.stepLine, styles.stepLineActive]} />
            <View style={[styles.step, styles.stepActive]}>
              <Text style={styles.stepText}>3</Text>
            </View>
          </View>
          
          {/* Affiliate Badge */}
          {affiliateName && (
            <View style={styles.affiliateBadge}>
              <Text style={styles.affiliateBadgeText}>
                🏢 Registering with: {affiliateName}
              </Text>
            </View>
          )}
          
          {/* Form */}
          <View style={styles.formContainer}>
            <Text style={styles.title}>Your Vehicle</Text>
            
            {/* Vehicle Type */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Vehicle Type *</Text>
              {loadingTypes ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={vehicleTypeId}
                    onValueChange={setVehicleTypeId}
                    style={styles.picker}
                    dropdownIconColor="#fff"
                  >
                    <Picker.Item label="Select type..." value="" color="#000" />
                    {vehicleTypes.map((type) => (
                      <Picker.Item key={type.id} label={type.name} value={type.id} color="#000" />
                    ))}
                  </Picker>
                </View>
              )}
            </View>
            
            {/* Make & Model */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Make</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Lincoln"
                  placeholderTextColor="#666"
                  value={vehicleMake}
                  onChangeText={setVehicleMake}
                  autoCapitalize="words"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>Model</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Navigator"
                  placeholderTextColor="#666"
                  value={vehicleModel}
                  onChangeText={setVehicleModel}
                  autoCapitalize="words"
                />
              </View>
            </View>
            
            {/* Year & Color */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Year</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={vehicleYear}
                    onValueChange={setVehicleYear}
                    style={styles.picker}
                    dropdownIconColor="#fff"
                  >
                    {years.map((year) => (
                      <Picker.Item key={year.value} label={year.label} value={year.value} color="#000" />
                    ))}
                  </Picker>
                </View>
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>Color</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={vehicleColor}
                    onValueChange={setVehicleColor}
                    style={styles.picker}
                    dropdownIconColor="#fff"
                  >
                    {VEHICLE_COLORS.map((color) => (
                      <Picker.Item key={color.value} label={color.label} value={color.value} color="#000" />
                    ))}
                  </Picker>
                </View>
              </View>
            </View>
            
            {/* Plate & Capacity */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>License Plate *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="ABC-1234"
                  placeholderTextColor="#666"
                  value={vehiclePlate}
                  onChangeText={(text) => setVehiclePlate(text.toUpperCase())}
                  autoCapitalize="characters"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>Capacity</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={vehicleCapacity}
                    onValueChange={setVehicleCapacity}
                    style={styles.picker}
                    dropdownIconColor="#fff"
                  >
                    {CAPACITIES.map((cap) => (
                      <Picker.Item key={cap.value} label={cap.label} value={cap.value} color="#000" />
                    ))}
                  </Picker>
                </View>
              </View>
            </View>
            
            {/* Permits Section */}
            <Text style={styles.sectionTitle}>Permits & Compliance</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Limo Permit #</Text>
              <TextInput
                style={styles.input}
                placeholder="MN Limo Permit Number"
                placeholderTextColor="#666"
                value={limoPermit}
                onChangeText={setLimoPermit}
              />
            </View>
            
            {limoPermit ? (
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>Permit Exp. Month</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={permitExpMonth}
                      onValueChange={setPermitExpMonth}
                      style={styles.picker}
                      dropdownIconColor="#fff"
                    >
                      {months.map((m) => (
                        <Picker.Item key={m.value} label={m.label} value={m.value} color="#000" />
                      ))}
                    </Picker>
                  </View>
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.label}>Permit Exp. Year</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={permitExpYear}
                      onValueChange={setPermitExpYear}
                      style={styles.picker}
                      dropdownIconColor="#fff"
                    >
                      {expirationYears.map((y) => (
                        <Picker.Item key={y.value} label={y.label} value={y.value} color="#000" />
                      ))}
                    </Picker>
                  </View>
                </View>
              </View>
            ) : null}
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>US DOT #</Text>
              <TextInput
                style={styles.input}
                placeholder="USDOT Number (if applicable)"
                placeholderTextColor="#666"
                value={dotNumber}
                onChangeText={setDotNumber}
              />
            </View>
            
            {/* Insurance Section */}
            <Text style={styles.sectionTitle}>Insurance Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Insurance Company</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Progressive, State Farm"
                placeholderTextColor="#666"
                value={insuranceCompany}
                onChangeText={setInsuranceCompany}
                autoCapitalize="words"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Policy Number</Text>
              <TextInput
                style={styles.input}
                placeholder="Insurance Policy #"
                placeholderTextColor="#666"
                value={insurancePolicy}
                onChangeText={setInsurancePolicy}
              />
            </View>
            
            {/* Navigation Buttons */}
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.backBtn} onPress={handleBack} disabled={isSubmitting}>
                <Text style={styles.backBtnText}>← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, !canSubmit && styles.btnDisabled]}
                onPress={handleSubmit}
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>🚀 Create Account</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Create dynamic styles based on theme colors
const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: width * 0.4,
    height: 80,
    maxWidth: 160,
  },
  tagline: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 8,
    textShadowColor: 'rgba(255, 107, 107, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  step: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  stepActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepComplete: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  stepText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: 8,
  },
  stepLineActive: {
    backgroundColor: colors.success,
  },
  affiliateBadge: {
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  affiliateBadgeText: {
    color: colors.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 16,
    marginBottom: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 16,
  },
  row: {
    flexDirection: 'row',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  picker: {
    color: colors.text,
    height: 50,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  backBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  backBtnText: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '500',
  },
  submitBtn: {
    flex: 2,
    backgroundColor: colors.success,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.5,
  },
});

export default RegisterVehicleScreen;
