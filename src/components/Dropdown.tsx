import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { useTranslation } from 'react-i18next';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { colors, spacing } from '../styles';

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
  placeholder,
  options,
  value,
  onChange,
  searchable = true,
  loading = false,
  error
}: DropdownProps) {
  const { t } = useTranslation('common');
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<RNTextInput>(null);
  const scaledTypography = useScaledTypography();
  const styles = useMemo(() => StyleSheet.create({
    container: {
      marginBottom: spacing.md,
    },
    label: {
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    trigger: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
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
      color: colors.textPrimary,
      flex: 1,
    },
    triggerTextPlaceholder: {
      color: colors.textSecondary,
    },
    errorText: {
      color: colors.danger,
      marginTop: spacing.xs / 2,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
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
  }), []);
  const displayPlaceholder = placeholder ?? t('select');

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
          { fontSize: scaledTypography.size.md },
          value?.id === item.id && styles.optionLabelSelected,
          item.disabled && styles.optionLabelDisabled
        ]}>
          {item.label}
        </Text>
        {item.subtitle && (
          <Text style={[styles.optionSubtitle, { fontSize: scaledTypography.size.sm }, item.disabled && styles.optionSubtitleDisabled]}>
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
      {label && <Text style={[styles.label, { fontSize: scaledTypography.size.sm }]}>{label}</Text>}
      
      <TouchableOpacity
        style={[styles.trigger, error && styles.triggerError]}
        onPress={() => setIsOpen(true)}
        disabled={loading}
      >
        <Text style={[
          styles.triggerText,
          { fontSize: scaledTypography.size.md },
          !value && styles.triggerTextPlaceholder
        ]}>
          {loading ? t('loading') : (value?.label || displayPlaceholder)}
        </Text>
        <Ionicons 
          name={isOpen ? 'chevron-up' : 'chevron-down'} 
          size={20} 
          color={colors.textSecondary} 
        />
      </TouchableOpacity>

      {error && <Text style={[styles.errorText, { fontSize: scaledTypography.size.sm }]}>{error}</Text>}

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
                  style={[styles.searchInput, { fontSize: scaledTypography.size.md }]}
                  placeholder={t('search')}
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
                <Text style={[styles.emptyText, { fontSize: scaledTypography.size.md }]}>
                  {searchQuery ? t('noResults') : t('noDataAvailable')}
                </Text>
              }
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
