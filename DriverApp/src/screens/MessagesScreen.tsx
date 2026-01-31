import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context';
import { spacing, fontSize, borderRadius } from '../config/theme';

interface Message {
  id: string;
  from: string;
  subject: string;
  preview: string;
  timestamp: string;
  isRead: boolean;
  type: 'dispatch' | 'system' | 'passenger';
}

// Mock messages for now
const MOCK_MESSAGES: Message[] = [
  {
    id: '1',
    from: 'Dispatch',
    subject: 'Welcome to ReliaLimo!',
    preview: 'Thank you for joining our driver team. Please complete your profile setup...',
    timestamp: '2 hours ago',
    isRead: false,
    type: 'dispatch',
  },
  {
    id: '2',
    from: 'System',
    subject: 'Profile Update Required',
    preview: 'Please update your vehicle information and upload your documents...',
    timestamp: 'Yesterday',
    isRead: true,
    type: 'system',
  },
  {
    id: '3',
    from: 'Dispatch',
    subject: 'New Trip Available',
    preview: 'A new trip has been assigned to you for tomorrow at 8:00 AM...',
    timestamp: '2 days ago',
    isRead: true,
    type: 'dispatch',
  },
];

export default function MessagesScreen() {
  const { colors } = useTheme();
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Create dynamic styles based on current theme
  const styles = useMemo(() => createStyles(colors), [colors]);

  const filteredMessages = messages.filter(msg =>
    msg.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    msg.preview.toLowerCase().includes(searchQuery.toLowerCase()) ||
    msg.from.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const unreadCount = messages.filter(m => !m.isRead).length;

  const getTypeIcon = (type: Message['type']) => {
    switch (type) {
      case 'dispatch': return '📡';
      case 'system': return '⚙️';
      case 'passenger': return '👤';
      default: return '📧';
    }
  };

  const markAsRead = (id: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === id ? { ...msg, isRead: true } : msg
    ));
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <TouchableOpacity 
      style={[styles.messageItem, !item.isRead && styles.messageUnread]}
      onPress={() => markAsRead(item.id)}
    >
      <View style={[styles.iconContainer, { backgroundColor: 
        item.type === 'dispatch' ? colors.primary + '20' :
        item.type === 'system' ? colors.warning + '20' :
        colors.info + '20'
      }]}>
        <Text style={styles.icon}>{getTypeIcon(item.type)}</Text>
      </View>
      <View style={styles.messageContent}>
        <View style={styles.messageHeader}>
          <Text style={[styles.messageSender, !item.isRead && styles.messageUnreadText]}>
            {item.from}
          </Text>
          <Text style={styles.messageTime}>{item.timestamp}</Text>
        </View>
        <Text style={[styles.messageSubject, !item.isRead && styles.messageUnreadText]} numberOfLines={1}>
          {item.subject}
        </Text>
        <Text style={styles.messagePreview} numberOfLines={1}>
          {item.preview}
        </Text>
      </View>
      {!item.isRead && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header Stats */}
      <View style={styles.header}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{messages.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={[styles.statItem, unreadCount > 0 && styles.statHighlight]}>
            <Text style={[styles.statNumber, unreadCount > 0 && styles.statNumberHighlight]}>
              {unreadCount}
            </Text>
            <Text style={[styles.statLabel, unreadCount > 0 && styles.statLabelHighlight]}>
              Unread
            </Text>
          </View>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search messages..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Messages List */}
      <FlatList
        data={filteredMessages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyTitle}>No Messages</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery ? 'No messages match your search' : 'Messages from dispatch will appear here'}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

// Create dynamic styles based on theme colors
const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  
  header: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statItem: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  statHighlight: {
    backgroundColor: colors.primary,
  },
  statNumber: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.text,
  },
  statNumberHighlight: {
    color: colors.white,
  },
  statLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statLabelHighlight: {
    color: colors.white + 'cc',
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    margin: spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
  },
  clearIcon: {
    fontSize: 18,
    color: colors.textMuted,
    padding: spacing.xs,
  },

  listContent: {
    padding: spacing.lg,
    paddingTop: 0,
  },

  messageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  messageUnread: {
    backgroundColor: colors.primary + '10',
    borderColor: colors.primary + '30',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  icon: {
    fontSize: 20,
  },
  messageContent: {
    flex: 1,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  messageSender: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  messageTime: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  messageSubject: {
    fontSize: fontSize.md,
    color: colors.text,
    marginBottom: 2,
  },
  messageUnreadText: {
    fontWeight: '600',
    color: colors.text,
  },
  messagePreview: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginLeft: spacing.sm,
  },

  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl * 2,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
