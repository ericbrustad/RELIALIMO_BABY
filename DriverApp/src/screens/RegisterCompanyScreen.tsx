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
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';
import { useTheme } from '../context';
import { spacing, fontSize, borderRadius } from '../config/theme';
import type { RootStackParamList } from '../types';

const { width } = Dimensions.get('window');

const LOGO_URL = 'https://siumiadylwcrkaqsfwkj.supabase.co/storage/v1/object/public/images/reliabull%20limo%20logowhitecropped.png';

type RouteParams = RouteProp<RootStackParamList, 'RegisterCompany'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

// Match web portal - uses affiliates table
type Affiliate = {
  id: string;
  company_name: string;
  primary_address?: string;
  city?: string;
  state?: string;
  phone?: string;
  organization_id?: string;
};

export function RegisterCompanyScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteParams>();
  const { userData } = route.params;
  const { colors } = useTheme();
  
  // Create dynamic styles based on current theme
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  // Company state
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyCity, setCompanyCity] = useState('');
  const [companyState, setCompanyState] = useState('');
  const [companyZip, setCompanyZip] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  
  // Matching state - uses affiliates table like web portal
  const [matchingAffiliates, setMatchingAffiliates] = useState<Affiliate[]>([]);
  const [selectedAffiliate, setSelectedAffiliate] = useState<Affiliate | null>(null);
  const [showMatches, setShowMatches] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // Search for matching affiliates (like web portal)
  useEffect(() => {
    const searchAffiliates = async () => {
      if (companyName.length < 2) {
        setMatchingAffiliates([]);
        setShowMatches(false);
        return;
      }
      
      setIsSearching(true);
      try {
        const { data, error } = await supabase
          .from('affiliates')
          .select('id, company_name, primary_address, city, state, phone, organization_id')
          .ilike('company_name', `%${companyName}%`)
          .limit(5);
        
        if (!error && data) {
          setMatchingAffiliates(data);
          setShowMatches(data.length > 0);
        }
      } catch (err) {
        console.log('[RegisterCompany] Search error:', err);
      } finally {
        setIsSearching(false);
      }
    };
    
    const timer = setTimeout(searchAffiliates, 300);
    return () => clearTimeout(timer);
  }, [companyName]);
  
  // Phone formatting
  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };
  
  // Select existing affiliate
  const handleSelectAffiliate = (affiliate: Affiliate) => {
    setSelectedAffiliate(affiliate);
    setCompanyName(affiliate.company_name);
    setShowMatches(false);
  };
  
  // Clear selection
  const handleClearSelection = () => {
    setSelectedAffiliate(null);
  };
  
  // Create new affiliate if needed, then continue
  const handleContinue = async () => {
    // If affiliate selected, use it directly
    if (selectedAffiliate) {
      navigation.navigate('RegisterVehicle', {
        userData,
        affiliateId: selectedAffiliate.id,
        affiliateName: selectedAffiliate.company_name,
      });
      return;
    }
    
    // If no company name, skip (independent driver)
    if (!companyName.trim()) {
      navigation.navigate('RegisterVehicle', {
        userData,
      });
      return;
    }
    
    // Create new affiliate
    setIsCreating(true);
    try {
      const affiliateData = {
        company_name: companyName.trim(),
        primary_address: companyAddress.trim() || null,
        city: companyCity.trim() || null,
        state: companyState.trim() || null,
        zip: companyZip.trim() || null,
        phone: companyPhone.replace(/\D/g, '') || null,
      };
      
      console.log('[RegisterCompany] Creating affiliate:', affiliateData);
      
      const { data: newAffiliate, error } = await supabase
        .from('affiliates')
        .insert(affiliateData)
        .select()
        .single();
      
      if (error) {
        console.error('[RegisterCompany] Affiliate creation error:', error);
        // Continue without affiliate if creation fails
        navigation.navigate('RegisterVehicle', {
          userData,
        });
        return;
      }
      
      console.log('[RegisterCompany] ✅ Affiliate created:', newAffiliate.id);
      
      navigation.navigate('RegisterVehicle', {
        userData,
        affiliateId: newAffiliate.id,
        affiliateName: newAffiliate.company_name,
      });
    } catch (err) {
      console.error('[RegisterCompany] Error:', err);
      // Continue without affiliate
      navigation.navigate('RegisterVehicle', {
        userData,
      });
    } finally {
      setIsCreating(false);
    }
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
                  if (selectedAffiliate) setSelectedAffiliate(null);
                }}
                autoCapitalize="words"
              />
              {isSearching && (
                <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />
              )}
              
              {/* Matching Affiliates Dropdown */}
              {showMatches && !selectedAffiliate && (
                <View style={styles.matchResults}>
                  {matchingAffiliates.map((affiliate) => (
                    <TouchableOpacity
                      key={affiliate.id}
                      style={styles.matchItem}
                      onPress={() => handleSelectAffiliate(affiliate)}
                    >
                      <Text style={styles.matchIcon}>🏢</Text>
                      <View style={styles.matchInfo}>
                        <Text style={styles.matchName}>{affiliate.company_name}</Text>
                        {affiliate.city && affiliate.state && (
                          <Text style={styles.matchAddress}>
                            {affiliate.city}, {affiliate.state}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            
            {/* Selected Affiliate Card */}
            {selectedAffiliate && (
              <View style={styles.selectedCard}>
                <View style={styles.selectedHeader}>
                  <Text style={styles.selectedIcon}>🏢</Text>
                  <Text style={styles.selectedName}>{selectedAffiliate.company_name}</Text>
                  <TouchableOpacity onPress={handleClearSelection}>
                    <Text style={styles.clearBtn}>✕</Text>
                  </TouchableOpacity>
                </View>
                {(selectedAffiliate.primary_address || selectedAffiliate.city) && (
                  <Text style={styles.selectedDetails}>
                    {selectedAffiliate.primary_address && `${selectedAffiliate.primary_address}, `}
                    {selectedAffiliate.city}, {selectedAffiliate.state}
                  </Text>
                )}
              </View>
            )}
            
            {/* New Company Form (only if no selection) */}
            {!selectedAffiliate && (
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
              <TouchableOpacity style={styles.backBtn} onPress={handleBack} disabled={isCreating}>
                <Text style={styles.backBtnText}>← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.continueBtn} onPress={handleContinue} disabled={isCreating}>
                {isCreating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.continueBtnText}>Continue →</Text>
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
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
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
  phoneInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  countryCode: {
    paddingLeft: 12,
    paddingRight: 8,
    fontSize: 14,
    color: colors.text,
  },
  phoneInput: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  matchResults: {
    backgroundColor: 'rgba(30, 30, 50, 0.98)',
    borderRadius: borderRadius.md,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    overflow: 'hidden',
  },
  matchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  matchIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  matchInfo: {
    flex: 1,
  },
  matchName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  matchAddress: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  selectedCard: {
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderRadius: borderRadius.lg,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.primary,
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
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  clearBtn: {
    color: colors.textSecondary,
    fontSize: 18,
    padding: 4,
  },
  selectedDetails: {
    color: colors.textSecondary,
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
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  backBtnText: {
    color: colors.text,
    fontSize: fontSize.md,
    fontWeight: '500',
  },
  continueBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  continueBtnText: {
    color: '#ffffff',
    fontSize: fontSize.md,
    fontWeight: '600',
  },
});

export default RegisterCompanyScreen;
