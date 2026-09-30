import "react-native-gesture-handler";
import React, { useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text, View, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import LoginScreen     from "./src/screens/LoginScreen";
import HomeScreen      from "./src/screens/HomeScreen";
import ScannerScreen   from "./src/screens/ScannerScreen";
import MarkLeaveScreen from "./src/screens/MarkLeaveScreen";
import ProfileScreen   from "./src/screens/ProfileScreen";

const Tab = createBottomTabNavigator();

function TabIcon({ icon, label, focused }) {
  return (
    <View style={{ alignItems: "center", paddingTop: 4 }}>
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <Text style={{ fontSize: 10, color: focused ? "#1F4E79" : "#9CA3AF", fontWeight: focused ? "700" : "400", marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}

export default function App() {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem("user").then((raw) => {
      if (raw) setUser(JSON.parse(raw));
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#1F4E79" }}>
        <Text style={{ fontSize: 48, marginBottom: 20 }}>📋</Text>
        <ActivityIndicator color="#fff" size="large" />
        <Text style={{ color: "rgba(255,255,255,0.7)", marginTop: 16, fontSize: 14 }}>QR Attend</Text>
      </View>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={(u) => setUser(u)} />;
  }

  const isTeacherOrAbove = ["teacher", "branch_admin", "school_admin", "super_admin"].includes(user.role);

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: { backgroundColor: "#fff", borderTopColor: "#E5E7EB", height: 64, paddingBottom: 8 },
          tabBarShowLabel: false,
        }}
      >
        <Tab.Screen name="Home" component={HomeScreen}
          options={{ tabBarIcon: ({ focused }) => <TabIcon icon="🏠" label="Today"   focused={focused} /> }}
        />
        <Tab.Screen name="Scanner" component={ScannerScreen}
          options={{ tabBarIcon: ({ focused }) => <TabIcon icon="📷" label="Scan"    focused={focused} /> }}
        />
        {isTeacherOrAbove && (
          <Tab.Screen name="Leave" component={MarkLeaveScreen}
            options={{ tabBarIcon: ({ focused }) => <TabIcon icon="🏖" label="Leave"  focused={focused} /> }}
          />
        )}
        <Tab.Screen name="Profile"
          options={{ tabBarIcon: ({ focused }) => <TabIcon icon="👤" label="Profile" focused={focused} /> }}
        >
          {() => <ProfileScreen onLogout={() => setUser(null)} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}
