import { useState } from 'react';
import { TextInput } from 'react-native';
import { useDemoData } from '@/lib/hooks/useDemoData';
import { FormScreenLayout } from '@/ui/layouts/FormScreenLayout';
import { spacing } from '@/ui/theme';

export const AuthScreen = () => {
  const data = useDemoData();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <FormScreenLayout
      title={data.authCopy.headline}
      description={data.authCopy.subline}
      primaryActionLabel="Continue"
      onPrimaryAction={() => {}}
      secondaryActionLabel="Need an account?"
      onSecondaryAction={() => {}}
    >
      <TextInput
        placeholder="Email"
        style={{ padding: spacing.md, borderRadius: 16, backgroundColor: '#f1f0fb' }}
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        style={{ padding: spacing.md, borderRadius: 16, backgroundColor: '#f1f0fb' }}
        value={password}
        onChangeText={setPassword}
      />
    </FormScreenLayout>
  );
};
