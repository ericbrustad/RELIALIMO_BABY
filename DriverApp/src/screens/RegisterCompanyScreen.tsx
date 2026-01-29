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
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';

const { width } = Dimensions.get('window');

const LOGO_URL = 'https://siumiadylwcrkaqsfwkj.supabase.co/storage/v1/object/public/images/reliabull%20limo%20logowhitecropped.png';

type RootStackParamList = {
  Auth: undefined;
  Register: undefined;
  RegisterCompany: { userData: any };
  RegisterVehicle: { userData: any; companyData: any };
  Dashboard: undefined;
};

type RouteParams = RouteProp<RootStackParamList, 'RegisterCompany'>;

type Company = {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
};

export function RegisterCompanyScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteParams>();
  const { userData } = route.params;
  
  // Company state
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyCity, setCompanyCity] = useState('');
  const [companyState, setCompanyState] = useState('');
  const [companyZip, setCompanyZip] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  
  // Matching state
  const [matchingCompanies, setMatchingCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [showMatches, setShowMatches] = useState(false);
  
  // Search for matching companies
  useEffect(() => {
    const searchCompanies = async () => {
      if (companyName.length < 2) {
        setMatchingCompanies([]);
        setShowMatches(false);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('id, name, address, city, state, phone')
          .ilike('name', `%${companyName}%`)
          .limit(5);
        
        if (!error && data) {
          setMatchingCompanies(data);
          setShowMatches(data.length > 0);
        }
      } catch (err) {
        console.log('[RegisterCompany] Search error:', err);
      }
    };
    
    const timer = setTimeout(searchCompanies, 300);
    return () => clearTimeout(timer);
  }, [companyName]);
  
  // Phone formatting
  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };
  
  // Select existing company
  const handleSelectCompany = (company: Company) => {
    setSelectedCompany(company);
    setCompanyName(company.name);
    setShowMatches(false);
  };
  
  // Clear selection
  const handleClearSelection = () => {
    setSelectedCompany(null);
  };
  
  // Continue to vehicle info
  const handleContinue = () => {
    const companyData = selectedCompany
      ? { existingCompanyId: selectedCompany.id, companyName: selectedCompany.name }
      : {
          companyName: companyName.trim() || null,
          companyAddress: companyAddress.trim() || null,
          companyCity: companyCity.trim() || null,
          companyState: companyState.trim() || null,
          companyZip: companyZip.trim() || null,
          companyPhone: companyPhone.replace(/\D/g, '') || null,
        };
    
    navigation.navigate('RegisterVehicle', {
      userData,
      companyData,
    });
  };
  
  // Go back
  const handleBack = () => {
    navigation.goBack();
  };
  
  const US_STATES = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
  ];
  
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
            <View style={[styles.step, styles.stepActive]}>
              <Text style={styles.stepText}>2</Text>
            </View>
            <View style={styles.stepLine} />
            <View style={styles.step}>
              <Text style={styles.stepText}>3</Text>
            </View>
          </View>
          
          {/* Form */}
          <View style={styles.formContainer}>
            <Text style={styles.title}>Your Company</Text>
            <Text style={styles.subtitle}>Optional - Leave blank if independent</Text>
            
            {/* Company Name with Search */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Company Name</Text>
              <TextInput
                style={styles.input}
                placeholder="ABC Transportation LLC"
                placeholderTextColor="#666"
                value={companyName}
                onChangeText={(text) => {
                  setCompanyName(text);
                  if (selectedCompany) setSelectedCompany(null);
                }}
                autoCapitalize="words"
              />
              
              {/* Matching Companies Dropdown */}
              {showMatches && !selectedCompany && (
                <View style={styles.matchResults}>
                  {matchingCompanies.map((company) => (
                    <TouchableOpacity
                      key={company.id}
                      style={styles.matchItem}
                      onPress={() => handleSelectCompany(company)}
                    >
                      <Text style={styles.matchIcon}>🏢</Text>
                      <View style={styles.matchInfo}>
                        <Text style={styles.matchName}>{company.name}</Text>
                        {company.city && company.state && (
                          <Text style={styles.matchAddress}>
                            {company.city}, {company.state}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            
            {/* Selected Company Card */}
            {selectedCompany && (
              <View style={styles.selectedCard}>
                <View style={styles.selectedHeader}>
                  <Text style={styles.selectedIcon}>🏢</Text>
                  <Text style={styles.selectedName}>{selectedCompany.name}</Text>
                  <TouchableOpacity onPress={handleClearSelection}>
                    <Text style={styles.clearBtn}>✕</Text>
                  </TouchableOpacity>
                </View>
                {(selectedCompany.address || selectedCompany.city) && (
                  <Text style={styles.selectedDetails}>
                    {selectedCompany.address && `${selectedCompany.address}, `}
                    {selectedCompany.city}, {selectedCompany.state}
                  </Text>
                )}
              </View>
            )}
            
            {/* New Company Form (only if no selection) */}
            {!selectedCompany && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Address</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="123 Main Street"
                    placeholderTextColor="#666"
                    value={companyAddress}
                    onChangeText={setCompanyAddress}
                    autoCapitalize="words"
                  />
                </View>
                
                <View style={styles.row}>
                  <View style={[styles.inputGroup, { flex: 2, marginRight: 8 }]}>
                    <Text style={styles.label}>City</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="City"
                      placeholderTextColor="#666"
                      value={companyCity}
                      onChangeText={setCompanyCity}
                      autoCapitalize="words"
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1, marginHorizontal: 4 }]}>
                    <Text style={styles.label}>State</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="MN"
                      placeholderTextColor="#666"
                      value={companyState}
                      onChangeText={(text) => setCompanyState(text.toUpperCase().slice(0, 2))}
                      autoCapitalize="characters"
                      maxLength={2}
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                    <Text style={styles.label}>Zip</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="55401"
                      placeholderTextColor="#666"
                      value={companyZip}
                      onChangeText={(text) => setCompanyZip(text.replace(/\D/g, '').slice(0, 5))}
                      keyboardType="number-pad"
                      maxLength={5}
                    />
                  </View>
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Company Phone</Text>
                  <View style={styles.phoneInputWrapper}>
                    <Text style={styles.countryCode}>🇺🇸 +1</Text>
                    <TextInput
                      style={[styles.input, styles.phoneInput]}
                      placeholder="(555) 987-6543"
                      placeholderTextColor="#666"
                      value={companyPhone}
                      onChangeText={(text) => setCompanyPhone(formatPhone(text))}
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>
              </>
            )}
            
            {/* Navigation Buttons */}
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
                <Text style={styles.backBtnText}>← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.continueBtn} onPress={handleContinue}>
                <Text style={styles.continueBtnText}>Continue →</Text>
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
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 20,
    textAlign: 'center',
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
  phoneInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  countryCode: {
    paddingLeft: 12,
    paddingRight: 8,
    fontSize: 14,
    color: '#fff',
  },
  phoneInput: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  matchResults: {
    backgroundColor: 'rgba(30, 30, 50, 0.98)',
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.5)',
    overflow: 'hidden',
  },
  matchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  matchIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  matchInfo: {
    flex: 1,
  },
  matchName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  matchAddress: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  selectedCard: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
  },
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  selectedName: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  clearBtn: {
    color: '#888',
    fontSize: 18,
    padding: 4,
  },
  selectedDetails: {
    color: '#aaa',
    fontSize: 13,
    marginTop: 6,
    marginLeft: 28,
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
  continueBtn: {
    flex: 1,
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  continueBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default RegisterCompanyScreen;
