import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context';
import { spacing, fontSize, borderRadius } from '../config/theme';
import { sendOtpEmail } from '../services/email';
import { sendOtpSms } from '../services/sms';
import type { RootStackParamList } from '../types';

const { width } = Dimensions.get('window');

const LOGO_URL = 'https://siumiadylwcrkaqsfwkj.supabase.co/storage/v1/object/public/images/reliabull%20limo%20logowhitecropped.png';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function RegisterScreen() {
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();
  
  // Create dynamic styles based on current theme
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // OTP verification state
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailOtp, setEmailOtp] = useState(['', '', '', '', '', '']);
  const [emailOtpCode, setEmailOtpCode] = useState('');
  
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState(['', '', '', '', '', '']);
  const [phoneOtpCode, setPhoneOtpCode] = useState('');
  
  // Loading states
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [sendingPhoneOtp, setSendingPhoneOtp] = useState(false);
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  
  // OTP input refs
  const emailOtpRefs = useRef<(TextInput | null)[]>([]);
  const phoneOtpRefs = useRef<(TextInput | null)[]>([]);
  
  // Resend timers
  const [emailResendTimer, setEmailResendTimer] = useState(0);
  const [phoneResendTimer, setPhoneResendTimer] = useState(0);
  
  useEffect(() => {
    if (emailResendTimer > 0) {
      const timer = setTimeout(() => setEmailResendTimer(emailResendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [emailResendTimer]);
  
  useEffect(() => {
    if (phoneResendTimer > 0) {
      const timer = setTimeout(() => setPhoneResendTimer(phoneResendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [phoneResendTimer]);
  
  // Email validation
  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };
  
  // Phone formatting
  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };
  
  // Send Email OTP
  const handleSendEmailOtp = async () => {
    if (!isValidEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    
    setSendingEmailOtp(true);
    try {
      // Generate 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setEmailOtpCode(code);
      
      // Send via Supabase Edge Function (Resend API)
      console.log('[RegisterScreen] Sending email OTP to:', email);
      const result = await sendOtpEmail(email, code, firstName);
      
      if (!result.success) {
        console.error('[RegisterScreen] Email send failed:', result.error);
        // Still allow proceeding in dev mode with the code shown
        Alert.alert(
          'Email Service Issue', 
          `Could not send email: ${result.error}\n\nFor testing, your code is: ${code}`
        );
      } else {
        console.log('[RegisterScreen] Email sent successfully');
        Alert.alert('Code Sent', `A verification code has been sent to ${email}`);
      }
      
      setEmailOtpSent(true);
      setEmailResendTimer(60);
    } catch (error) {
      console.error('[RegisterScreen] Email OTP error:', error);
      Alert.alert('Error', 'Failed to send verification code');
    } finally {
      setSendingEmailOtp(false);
    }
  };
  
  // Verify Email OTP
  const handleVerifyEmailOtp = () => {
    const enteredCode = emailOtp.join('');
    if (enteredCode === emailOtpCode) {
      setEmailVerified(true);
      setEmailOtpSent(false);
      Alert.alert('Success', 'Email verified!');
    } else {
      Alert.alert('Error', 'Invalid verification code');
      setEmailOtp(['', '', '', '', '', '']);
      emailOtpRefs.current[0]?.focus();
    }
  };
  
  // Send Phone OTP
  const handleSendPhoneOtp = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }
    
    setSendingPhoneOtp(true);
    try {
      // Generate 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setPhoneOtpCode(code);
      
      // Format phone number with country code
      const formattedPhone = digits.length === 10 ? `+1${digits}` : `+${digits}`;
      
      // Send via SMS API
      const result = await sendOtpSms(formattedPhone, code);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to send SMS');
      }
      
      console.log('[RegisterScreen] Phone OTP sent successfully');
      
      setPhoneOtpSent(true);
      setPhoneResendTimer(60);
      Alert.alert('Code Sent', `A verification code has been sent to ${phone}`);
    } catch (error) {
      console.error('[RegisterScreen] SMS error:', error);
      Alert.alert('Error', 'Failed to send verification code. Please try again.');
    } finally {
      setSendingPhoneOtp(false);
    }
  };
  
  // Verify Phone OTP
  const handleVerifyPhoneOtp = () => {
    const enteredCode = phoneOtp.join('');
    if (enteredCode === phoneOtpCode) {
      setPhoneVerified(true);
      setPhoneOtpSent(false);
      Alert.alert('Success', 'Phone verified!');
    } else {
      Alert.alert('Error', 'Invalid verification code');
      setPhoneOtp(['', '', '', '', '', '']);
      phoneOtpRefs.current[0]?.focus();
    }
  };
  
  // OTP input handler
  const handleOtpChange = (
    index: number,
    value: string,
    otp: string[],
    setOtp: (otp: string[]) => void,
    refs: React.MutableRefObject<(TextInput | null)[]>
  ) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    
    // Auto-focus next input
    if (value && index < 5) {
      refs.current[index + 1]?.focus();
    }
    
    // Auto-verify when all digits entered
    if (value && index === 5 && newOtp.every(d => d)) {
      // Will trigger verification
    }
  };
  
  const handleOtpKeyPress = (
    index: number,
    key: string,
    otp: string[],
    setOtp: (otp: string[]) => void,
    refs: React.MutableRefObject<(TextInput | null)[]>
  ) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
      refs.current[index - 1]?.focus();
    }
  };
  
  // Continue to next step
  const handleContinue = () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Error', 'Please enter your first and last name');
      return;
    }
    if (!emailVerified) {
      Alert.alert('Error', 'Please verify your email address');
      return;
    }
    if (!phoneVerified) {
      Alert.alert('Error', 'Please verify your phone number');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }
    
    // Navigate to company info step
    navigation.navigate('RegisterCompany', {
      userData: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.replace(/\D/g, ''),
        password,
      },
    });
  };
  
  const canContinue = firstName.trim() && lastName.trim() && emailVerified && phoneVerified && password.length >= 8;
  
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
            <View style={[styles.step, styles.stepActive]}>
              <Text style={styles.stepText}>1</Text>
            </View>
            <View style={styles.stepLine} />
            <View style={styles.step}>
              <Text style={styles.stepText}>2</Text>
            </View>
            <View style={styles.stepLine} />
            <View style={styles.step}>
              <Text style={styles.stepText}>3</Text>
            </View>
          </View>
          
          {/* Form */}
          <View style={styles.formContainer}>
            <Text style={styles.title}>Create Your Account</Text>
            
            {/* Name Fields */}
            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>First Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="John"
                  placeholderTextColor="#666"
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>Last Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Doe"
                  placeholderTextColor="#666"
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                />
              </View>
            </View>
            
            {/* Email with OTP */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email *</Text>
              <View style={styles.verifyRow}>
                <TextInput
                  style={[styles.input, styles.verifyInput, emailVerified && styles.inputVerified]}
                  placeholder="john@example.com"
                  placeholderTextColor="#666"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!emailVerified}
                />
                {!emailVerified && (
                  <TouchableOpacity
                    style={[styles.sendCodeBtn, sendingEmailOtp && styles.btnDisabled]}
                    onPress={handleSendEmailOtp}
                    disabled={sendingEmailOtp || emailResendTimer > 0}
                  >
                    {sendingEmailOtp ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.sendCodeText}>
                        {emailResendTimer > 0 ? `${emailResendTimer}s` : 'Send Code'}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
              {emailVerified && (
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedText}>✓ Email Verified</Text>
                </View>
              )}
            </View>
            
            {/* Email OTP Input */}
            {emailOtpSent && !emailVerified && (
              <View style={styles.otpSection}>
                <Text style={styles.otpInstruction}>
                  Enter the 6-digit code sent to <Text style={styles.bold}>{email}</Text>
                </Text>
                <View style={styles.otpInputGroup}>
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <TextInput
                      key={index}
                      ref={(ref) => { emailOtpRefs.current[index] = ref; }}
                      style={[styles.otpDigit, emailOtp[index] && styles.otpDigitFilled]}
                      value={emailOtp[index]}
                      onChangeText={(value) => handleOtpChange(index, value, emailOtp, setEmailOtp, emailOtpRefs)}
                      onKeyPress={({ nativeEvent }) => handleOtpKeyPress(index, nativeEvent.key, emailOtp, setEmailOtp, emailOtpRefs)}
                      keyboardType="number-pad"
                      maxLength={1}
                    />
                  ))}
                </View>
                <View style={styles.otpActions}>
                  <TouchableOpacity
                    style={[styles.verifyBtn, !emailOtp.every(d => d) && styles.btnDisabled]}
                    onPress={handleVerifyEmailOtp}
                    disabled={!emailOtp.every(d => d)}
                  >
                    <Text style={styles.verifyBtnText}>Verify</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            
            {/* Phone with OTP */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Cell Phone *</Text>
              <View style={styles.verifyRow}>
                <View style={styles.phoneInputWrapper}>
                  <Text style={styles.countryCode}>🇺🇸 +1</Text>
                  <TextInput
                    style={[styles.input, styles.phoneInput, phoneVerified && styles.inputVerified]}
                    placeholder="(555) 123-4567"
                    placeholderTextColor="#666"
                    value={phone}
                    onChangeText={(text) => setPhone(formatPhone(text))}
                    keyboardType="phone-pad"
                    editable={!phoneVerified && emailVerified}
                  />
                </View>
                {!phoneVerified && emailVerified && (
                  <TouchableOpacity
                    style={[styles.sendCodeBtn, sendingPhoneOtp && styles.btnDisabled]}
                    onPress={handleSendPhoneOtp}
                    disabled={sendingPhoneOtp || phoneResendTimer > 0}
                  >
                    {sendingPhoneOtp ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.sendCodeText}>
                        {phoneResendTimer > 0 ? `${phoneResendTimer}s` : 'Send Code'}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
              {phoneVerified && (
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedText}>✓ Phone Verified</Text>
                </View>
              )}
              {!emailVerified && !phoneVerified && (
                <Text style={styles.hint}>Verify email first</Text>
              )}
            </View>
            
            {/* Phone OTP Input */}
            {phoneOtpSent && !phoneVerified && (
              <View style={styles.otpSection}>
                <Text style={styles.otpInstruction}>
                  Enter the 6-digit code sent to <Text style={styles.bold}>{phone}</Text>
                </Text>
                <View style={styles.otpInputGroup}>
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <TextInput
                      key={index}
                      ref={(ref) => { phoneOtpRefs.current[index] = ref; }}
                      style={[styles.otpDigit, phoneOtp[index] && styles.otpDigitFilled]}
                      value={phoneOtp[index]}
                      onChangeText={(value) => handleOtpChange(index, value, phoneOtp, setPhoneOtp, phoneOtpRefs)}
                      onKeyPress={({ nativeEvent }) => handleOtpKeyPress(index, nativeEvent.key, phoneOtp, setPhoneOtp, phoneOtpRefs)}
                      keyboardType="number-pad"
                      maxLength={1}
                    />
                  ))}
                </View>
                <View style={styles.otpActions}>
                  <TouchableOpacity
                    style={[styles.verifyBtn, !phoneOtp.every(d => d) && styles.btnDisabled]}
                    onPress={handleVerifyPhoneOtp}
                    disabled={!phoneOtp.every(d => d)}
                  >
                    <Text style={styles.verifyBtnText}>Verify</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            
            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Create Password *</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Min 8 characters"
                  placeholderTextColor="#666"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={phoneVerified}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={styles.eyeIcon}>
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </Text>
                </TouchableOpacity>
              </View>
              {!phoneVerified && (
                <Text style={styles.hint}>Verify phone first</Text>
              )}
            </View>
            
            {/* Continue Button */}
            <TouchableOpacity
              style={[styles.continueBtn, !canContinue && styles.btnDisabled]}
              onPress={handleContinue}
              disabled={!canContinue}
            >
              <Text style={styles.continueBtnText}>Continue →</Text>
            </TouchableOpacity>
          </View>
          
          {/* Back to Login */}
          <View style={styles.switchContainer}>
            <Text style={styles.switchText}>Already have an account?</Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.switchLink}>Sign In</Text>
            </TouchableOpacity>
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
  inputVerified: {
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  verifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verifyInput: {
    flex: 1,
  },
  phoneInputWrapper: {
    flex: 1,
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
  sendCodeBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 10,
    minWidth: 90,
    alignItems: 'center',
  },
  sendCodeText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  verifiedBadge: {
    marginTop: 8,
  },
  verifiedText: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '600',
  },
  hint: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  otpSection: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  otpInstruction: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  bold: {
    fontWeight: '600',
    color: '#fff',
  },
  otpInputGroup: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  otpDigit: {
    width: 44,
    height: 50,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  otpDigitFilled: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
  },
  otpActions: {
    alignItems: 'center',
  },
  verifyBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 10,
  },
  verifyBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  passwordInput: {
    flex: 1,
    padding: 14,
    fontSize: 16,
    color: '#ffffff',
  },
  eyeButton: {
    padding: 14,
  },
  eyeIcon: {
    fontSize: 18,
  },
  continueBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  continueBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    gap: 8,
  },
  switchText: {
    color: '#888',
    fontSize: 14,
  },
  switchLink: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default RegisterScreen;
