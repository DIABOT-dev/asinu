import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
    FlatList,
    Keyboard,
    Modal,
    TextInput as RNTextInput,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { colors, spacing, typography } from '../styles';

export type DropdownOption = {
  id: string;
  label: string;
  subtitle?: string;
  disabled?: boolean;
};

interface DropdownProps {
  label?: string;
  placeholder?: string;
  options: DropdownOption[];
  value: DropdownOption | null;
  onChange: (option: DropdownOption) => void;
  searchable?: boolean;
  loading?: boolean;
  error?: string;
}

export function Dropdown({
  label,
  placeholder = 'Chọn...',
  options,
  value,
  onChange,
  searchable = true,
  loading = false,
  error
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<RNTextInput>(null);

  useEffect(() => {
    if (isOpen && searchable) {
      // Delay to allow modal animation
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, searchable]);

  const filteredOptions = searchable && searchQuery
    ? options.filter(opt => 
        opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        opt.subtitle?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;

  const handleSelect = (option: DropdownOption) => {
    onChange(option);
    setIsOpen(false);
    setSearchQuery('');
    Keyboard.dismiss();
  };

  const renderOption = ({ item }: { item: DropdownOption }) => (
    <TouchableOpacity
      style={[
        styles.option,
        value?.id === item.id && styles.optionSelected,
        item.disabled && styles.optionDisabled
      ]}
      onPress={() => !item.disabled && handleSelect(item)}
      disabled={item.disabled}
    >
      <View style={styles.optionContent}>
        <Text style={[
          styles.optionLabel,
          value?.id === item.id && styles.optionLabelSelected,
          item.disabled && styles.optionLabelDisabled
        ]}>
          {item.label}
        </Text>
        {item.subtitle && (
          <Text style={[styles.optionSubtitle, item.disabled && styles.optionSubtitleDisabled]}>
            {item.subtitle}
          </Text>
        )}
      </View>
      {value?.id === item.id && (
        <Ionicons name="checkmark" size={20} color={colors.primary} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <TouchableOpacity
        style={[styles.trigger, error && styles.triggerError]}
        onPress={() => setIsOpen(true)}
        disabled={loading}
      >
        <Text style={[
          styles.triggerText,
          !value && styles.triggerTextPlaceholder
        ]}>
          {loading ? 'Đang tải...' : (value?.label || placeholder)}
        </Text>
        <Ionicons 
          name={isOpen ? 'chevron-up' : 'chevron-down'} 
          size={20} 
          color={colors.textSecondary} 
        />
      </TouchableOpacity>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1}
          onPress={() => setIsOpen(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            {searchable && (
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color={colors.textSecondary} />
                <RNTextInput
                  ref={searchInputRef}
                  style={styles.searchInput}
                  placeholder="Tìm kiếm..."
                  placeholderTextColor={colors.textSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            )}
            
            <FlatList
              data={filteredOptions}
              renderItem={renderOption}
              keyExtractor={(item) => item.id}
              style={styles.optionsList}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  {searchQuery ? 'Không tìm thấy kết quả' : 'Không có dữ liệu'}
                </Text>
              }
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.size.sm,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 48,
  },
  triggerError: {
    borderColor: colors.danger,
  },
  triggerText: {
    fontSize: typography.size.md,
    color: colors.textPrimary,
    flex: 1,
  },
  triggerTextPlaceholder: {
    color: colors.textSecondary,
  },
  errorText: {
    fontSize: typography.size.sm,
    color: colors.danger,
    marginTop: spacing.xs / 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    maxHeight: '70%',
    overflow: 'hidden',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    fontSize: typography.size.md,
    color: colors.textPrimary,
  },
  optionsList: {
    maxHeight: 400,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionSelected: {
    backgroundColor: colors.primary + '10',
  },
  optionDisabled: {
    opacity: 0.5,
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: typography.size.md,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  optionLabelSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  optionLabelDisabled: {
    color: colors.textSecondary,
  },
  optionSubtitle: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs / 2,
  },
  optionSubtitleDisabled: {
    color: colors.textSecondary + '80',
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textSecondary,
    padding: spacing.xl,
  },
});
