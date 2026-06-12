import React from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

type Task = {
  id: string;
  title: string;
  note: string;
};

const initialTasks: Task[] = [
  {
    id: 'task-1',
    title: 'Prepare mobile testcase',
    note: 'Cover login, create, edit, delete, and logout flows.',
  },
  {
    id: 'task-2',
    title: 'Verify selectors',
    note: 'Use stable testID values for Appium or Detox.',
  },
];

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);
  const [email, setEmail] = React.useState('tester@example.com');
  const [password, setPassword] = React.useState('password123');
  const [loginError, setLoginError] = React.useState('');
  const [tasks, setTasks] = React.useState<Task[]>(initialTasks);
  const [title, setTitle] = React.useState('');
  const [note, setNote] = React.useState('');
  const [editingTaskId, setEditingTaskId] = React.useState<string | null>(null);

  const editingTask = tasks.find((task) => task.id === editingTaskId);

  function resetForm() {
    setTitle('');
    setNote('');
    setEditingTaskId(null);
  }

  function handleLogin() {
    if (email.trim() === 'tester@example.com' && password === 'password123') {
      setLoginError('');
      setIsLoggedIn(true);
      return;
    }

    setLoginError('Invalid email or password');
  }

  function handleLogout() {
    resetForm();
    setIsLoggedIn(false);
  }

  function handleSaveTask() {
    const cleanTitle = title.trim();
    const cleanNote = note.trim();

    if (!cleanTitle) {
      Alert.alert('Validation', 'Task title is required.');
      return;
    }

    if (editingTaskId) {
      setTasks((currentTasks) =>
        currentTasks.map((task) =>
          task.id === editingTaskId ? { ...task, title: cleanTitle, note: cleanNote } : task,
        ),
      );
      resetForm();
      return;
    }

    setTasks((currentTasks) => [
      {
        id: `task-${Date.now()}`,
        title: cleanTitle,
        note: cleanNote,
      },
      ...currentTasks,
    ]);
    resetForm();
  }

  function handleEditTask(task: Task) {
    setEditingTaskId(task.id);
    setTitle(task.title);
    setNote(task.note);
  }

  function handleDeleteTask(taskId: string) {
    setTasks((currentTasks) => currentTasks.filter((task) => task.id !== taskId));

    if (editingTaskId === taskId) {
      resetForm();
    }
  }

  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.loginContainer}
        >
          <View style={styles.loginHeader}>
            <Text style={styles.eyebrow}>Mobile Test Target</Text>
            <Text style={styles.title}>QA Tasks</Text>
            <Text style={styles.subtitle}>Use the demo account to test a basic mobile flow.</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              accessibilityLabel="Email input"
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="tester@example.com"
              style={styles.input}
              testID="login-email-input"
              value={email}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              accessibilityLabel="Password input"
              onChangeText={setPassword}
              placeholder="password123"
              secureTextEntry
              style={styles.input}
              testID="login-password-input"
              value={password}
            />
          </View>

          {loginError ? (
            <Text accessibilityRole="alert" style={styles.errorText} testID="login-error-text">
              {loginError}
            </Text>
          ) : null}

          <Pressable
            accessibilityLabel="Login button"
            onPress={handleLogin}
            style={styles.primaryButton}
            testID="login-submit-button"
          >
            <Text style={styles.primaryButtonText}>Log in</Text>
          </Pressable>

          <Text style={styles.helperText} testID="login-demo-credentials">
            Demo: tester@example.com / password123
          </Text>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.appContainer} testID="tasks-screen">
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Signed in as</Text>
            <Text style={styles.screenTitle} testID="signed-in-email-text">
              {email}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Logout button"
            onPress={handleLogout}
            style={styles.secondaryButton}
            testID="logout-button"
          >
            <Text style={styles.secondaryButtonText}>Logout</Text>
          </Pressable>
        </View>

        <View style={styles.editor}>
          <Text style={styles.sectionTitle} testID="task-form-title">
            {editingTask ? 'Edit task' : 'Create task'}
          </Text>

          <TextInput
            accessibilityLabel="Task title input"
            onChangeText={setTitle}
            placeholder="Task title"
            style={styles.input}
            testID="task-title-input"
            value={title}
          />
          <TextInput
            accessibilityLabel="Task note input"
            multiline
            onChangeText={setNote}
            placeholder="Task note"
            style={[styles.input, styles.textArea]}
            testID="task-note-input"
            value={note}
          />

          <View style={styles.formActions}>
            <Pressable
              accessibilityLabel={editingTask ? 'Update task button' : 'Create task button'}
              onPress={handleSaveTask}
              style={[styles.primaryButton, styles.actionButton]}
              testID="task-save-button"
            >
              <Text style={styles.primaryButtonText}>{editingTask ? 'Update' : 'Create'}</Text>
            </Pressable>

            {editingTask ? (
              <Pressable
                accessibilityLabel="Cancel edit button"
                onPress={resetForm}
                style={styles.secondaryButton}
                testID="task-cancel-edit-button"
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <FlatList
          contentContainerStyle={styles.listContent}
          data={tasks}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <Text style={styles.emptyText} testID="task-empty-text">
              No tasks yet.
            </Text>
          }
          renderItem={({ item, index }) => (
            <View style={styles.taskCard} testID={`task-card-${index}`}>
              <View style={styles.taskText}>
                <Text style={styles.taskTitle} testID={`task-title-${index}`}>
                  {item.title}
                </Text>
                <Text style={styles.taskNote} testID={`task-note-${index}`}>
                  {item.note || 'No note'}
                </Text>
              </View>

              <View style={styles.taskActions}>
                <Pressable
                  accessibilityLabel={`Edit ${item.title}`}
                  onPress={() => handleEditTask(item)}
                  style={styles.smallButton}
                  testID={`task-edit-button-${index}`}
                >
                  <Text style={styles.smallButtonText}>Edit</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={`Delete ${item.title}`}
                  onPress={() => handleDeleteTask(item.id)}
                  style={[styles.smallButton, styles.dangerButton]}
                  testID={`task-delete-button-${index}`}
                >
                  <Text style={styles.smallButtonText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          )}
          style={styles.list}
          testID="task-list"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  loginHeader: {
    marginBottom: 32,
  },
  eyebrow: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  title: {
    color: '#0f172a',
    fontSize: 36,
    fontWeight: '800',
  },
  subtitle: {
    color: '#475569',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 10,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 8,
    borderWidth: 1,
    color: '#0f172a',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textArea: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  actionButton: {
    flex: 1,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
  },
  helperText: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 18,
    textAlign: 'center',
  },
  appContainer: {
    flex: 1,
    padding: 16,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  screenTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
  },
  editor: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '800',
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
  },
  list: {
    marginTop: 14,
  },
  listContent: {
    gap: 10,
    paddingBottom: 24,
  },
  taskCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  taskText: {
    gap: 4,
    marginBottom: 12,
  },
  taskTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
  taskNote: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
  },
  taskActions: {
    flexDirection: 'row',
    gap: 10,
  },
  smallButton: {
    alignItems: 'center',
    backgroundColor: '#334155',
    borderRadius: 8,
    flex: 1,
    minHeight: 40,
    justifyContent: 'center',
  },
  dangerButton: {
    backgroundColor: '#dc2626',
  },
  smallButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 15,
    padding: 24,
    textAlign: 'center',
  },
});
