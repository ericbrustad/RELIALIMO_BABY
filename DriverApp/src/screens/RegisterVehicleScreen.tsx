import React, { useState, useEffect } from 'react';
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

const { width } = Dimensions.get('window');

const LOGO_URL = 'https://siumiadylwcrkaqsfwkj.supabase.co/storage/v1/object/public/images/reliabull%20limo%20logowhitecropped.png';

type RootStackParamList = {
  Auth: undefined;
  Register: undefined;
  RegisterCompany: { userData: any };
  RegisterVehicle: { userData: any; companyData: any };
  Welcome: { driverName: string; driverId: string };
  Dashboard: undefined;
};

type RouteParams = RouteProp<RootStackParamList, 'RegisterVehicle'>;

const VEHICLE_TYPES = [
  { value: '', label: 'Select type...' },
  { value: 'sedan', label: 'Sedan' },
  { value: 'suv', label: 'SUV' },
  { value: 'van', label: 'Van' },
  { value: 'limousine', label: 'Limousine' },
  { value: 'sprinter', label: 'Sprinter' },
  { value: 'bus', label: 'Bus' },
  { value: 'other', label: 'Other' },
];

const VEHICLE_COLORS = [
  { value: '', label: 'Select color...' },
  { value: 'black', label: 'Black' },
  { value: 'white', label: 'White' },
  { value: 'silver', label: 'Silver' },
  { value: 'gray', label: 'Gray' },
  { value: 'blue', label: 'Blue' },
  { value: 'red', label: 'Red' },
  { value: 'other', label: 'Other' },
];

const CAPACITIES = [
  { value: '3', label: '3 passengers' },
  { value: '4', label: '4 passengers' },
  { value: '5', label: '5 passengers' },
  { value: '6', label: '6 passengers' },
  { value: '7', label: '7 passengers' },
  { value: '8', label: '8+ passengers' },
];

export function RegisterVehicleScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteParams>();
  const { userData, companyData } = route.params;
  
  // Vehicle state
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleCapacity, setVehicleCapacity] = useState('4');
  
  // Permits & Insurance
  const [limoPermit, setLimoPermit] = useState('');
  const [dotNumber, setDotNumber] = useState('');
  const [insuranceCompany, setInsuranceCompany] = useState('');
  const [insurancePolicy, setInsurancePolicy] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Generate year options
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 30 }, (_, i) => ({
    value: String(currentYear - i),
    label: String(currentYear - i),
  }));
  years.unshift({ value: '', label: 'Select year...' });
  
  // Validate form
  const canSubmit = vehicleType && vehiclePlate.trim() && insuranceCompany.trim() && insurancePolicy.trim();
  
  // Submit registration
  const handleSubmit = async () => {
    if (!canSubmit) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // 1. Create Supabase auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
      });
      
      if (authError) {
        throw new Error(authError.message);
      }
      
      // 2. Create company if new
      let companyId = companyData.existingCompanyId || null;
      
      if (!companyId && companyData.companyName) {
        const { data: newCompany, error: companyError } = await supabase
          .from('companies')
          .insert({
            name: companyData.companyName,
            address: companyData.companyAddress,
            city: companyData.companyCity,
            state: companyData.companyState,
            zip: companyData.companyZip,
            phone: companyData.companyPhone,
          })
          .select()
          .single();
        
        if (companyError) {
          console.warn('[RegisterVehicle] Company creation error:', companyError);
        } else {
          companyId = newCompany.id;
        }
      }
      
      // 3. Create driver record
      const { data: driverData, error: driverError } = await supabase
        .from('drivers')
        .insert({
          first_name: userData.firstName,
          last_name: userData.lastName,
          email: userData.email,
          phone: userData.phone,
          company_id: companyId,
          vehicle_type: vehicleType,
          vehicle_make: vehicleMake,
          vehicle_model: vehicleModel,
          vehicle_year: vehicleYear ? parseInt(vehicleYear) : null,
          vehicle_color: vehicleColor,
          vehicle_plate: vehiclePlate.toUpperCase(),
          passenger_capacity: parseInt(vehicleCapacity),
          limo_permit: limoPermit || null,
          dot_number: dotNumber || null,
          insurance_company: insuranceCompany,
          insurance_policy: insurancePolicy,
          status: 'pending', // Pending admin approval
        })
        .select()
        .single();
      
      if (driverError) {
        throw new Error(driverError.message);
      }
      
      // Navigate to welcome screen
      navigation.reset({
        index: 0,
        routes: [{
          name: 'Welcome',
          params: {
            driverName: `${userData.firstName} ${userData.lastName}`,
            driverId: driverData.id,
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
          
          {/* Form */}
          <View style={styles.formContainer}>
            <Text style={styles.title}>Your Vehicle</Text>
            
            {/* Vehicle Type */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Vehicle Type *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={vehicleType}
                  onValueChange={setVehicleType}
                  style={styles.picker}
                  dropdownIconColor="#fff"
                >
                  {VEHICLE_TYPES.map((type) => (
                    <Picker.Item key={type.value} label={type.label} value={type.value} color="#000" />
                  ))}
                </Picker>
              </View>
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
            
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Limo Permit #</Text>
                <TextInput
                  style={styles.input}
                  placeholder="MN Permit #"
                  placeholderTextColor="#666"
                  value={limoPermit}
                  onChangeText={setLimoPermit}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>US DOT #</Text>
                <TextInput
                  style={styles.input}
                  placeholder="USDOT #"
                  placeholderTextColor="#666"
                  value={dotNumber}
                  onChangeText={setDotNumber}
                />
              </View>
            </View>
            
            {/* Insurance Section */}
            <Text style={styles.sectionTitle}>Insurance Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Insurance Company *</Text>
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
              <Text style={styles.label}>Policy Number *</Text>
              <TextInput
                style={styles.input}
                placeholder="Policy #"
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
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
    color: '#ffffff',
    marginTop: 8,
    textShadowColor: 'rgba(99, 102, 241, 0.8)',
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
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  stepComplete: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
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
    backgroundColor: '#22c55e',
  },
  formContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 20,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#aaa',
    marginTop: 16,
    marginBottom: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
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
    color: '#aaa',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  pickerContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  picker: {
    color: '#ffffff',
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
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  backBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  submitBtn: {
    flex: 2,
    backgroundColor: '#22c55e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.5,
  },
});

export default RegisterVehicleScreen;
