import React, { Component, ReactNode } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { reloadAppAsync } from "expo";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

function ErrorFallback({ error, onReset }: { error: Error | null; onReset: () => void }) {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name="alert-circle" size={48} color="#EF4444" />
      </View>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>{error?.message || "An unexpected error occurred"}</Text>
      <Pressable onPress={onReset} style={styles.button}>
        <Text style={styles.buttonText}>Restart App</Text>
      </Pressable>
    </View>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error("ErrorBoundary caught:", error);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    reloadAppAsync();
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onReset={this.handleReset} />;
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 16,
  },
  iconContainer: {
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: "#FFF",
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 20,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#7C3AED",
    marginTop: 8,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: "#FFF",
  },
});
