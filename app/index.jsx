import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  Pressable,
  Image,
  useWindowDimensions,
  ScrollView,
} from "react-native";
import React, { useEffect } from "react";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { ReactNativeZoomableView } from "@openspacelabs/react-native-zoomable-view";
import Svg, { Path, Circle } from "react-native-svg";

const Home = () => {
  const { width } = useWindowDimensions();

  // Card width responsive
  const cardW = Math.min(width - 48, 520);
  const cardH = cardW * 0.78; // tweak to match your image aspect

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("http://192.168.1.38:8000/hello_world", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const data = await res.json();
        console.log(data);
      } catch (e) {
        console.log("fetch failed", e);
      }
    })();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View>
        <View style={styles.searchBar}>
          <View style={styles.searchToggle}>
            <Pressable style={styles.iconbtn}>
              <Ionicons name="menu" size={22} color="#111827" />
            </Pressable>
          </View>
          <View style={styles.searchText}>
            <Text>Where can I take you?</Text>
          </View>
          <View></View>
        </View>
        <View style={styles.mapCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <ReactNativeZoomableView
                maxZoom={3}
                minZoom={1}
                zoomStep={0.5}
                initialZoom={1}
              >
                <Image
                  source={require("../assets/ground_floor.png")}
                  style={styles.mapImage}
                  resizeMode="contain"
                />
              </ReactNativeZoomableView>
            </ScrollView>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default Home;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#CAD1DF",
  },
  searchBar: {
    backgroundColor: "#ffffff",
    borderRadius: 30,
    height: 72,
    width: "85%",
    alignSelf: "center",
    marginTop: 20,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    flexDirection: "row",

    // shadow
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },

  iconbtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  searchText: {
    opacity: 0.5,
    fontSize: 20,
    fontWeight: 500,
    textAlign: "center",
    fontFamily: "Ariel",
  },
  mapCard: {
    alignSelf: "center",
    borderRadius: 22,
    overflow: "hidden",

    backgroundColor: "#aab3c0",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
});
