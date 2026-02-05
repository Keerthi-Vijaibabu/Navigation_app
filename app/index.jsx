import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  Pressable,
  Image,
  useWindowDimensions,
  ScrollView,
  TextInput,
} from "react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { ReactNativeZoomableView } from "@openspacelabs/react-native-zoomable-view";
import Svg, { Circle } from "react-native-svg";
import { Magnetometer } from "expo-sensors";
import * as Location from "expo-location";

const Home = () => {
  const { width } = useWindowDimensions();

  const [locPerm, setLocPerm] = useState(false);
  const [mag, setMag] = useState({ x: null, y: null, z: null, ts: null });
  const [gps, setGps] = useState({ lat: null, lon: null, ts: null });

  const [marker, setMarker] = useState(null);

  const [room, setRoom] = useState("");

  const [imgLayout, setImgLayout] = useState({ w: 0, h: 0 });

  const inFlight = useRef(false);
  const magRef = useRef(mag);
  const gpsRef = useRef(gps);
  const roomRef = useRef(room);

  useEffect(() => {
    magRef.current = mag;
  }, [mag]);

  useEffect(() => {
    gpsRef.current = gps;
  }, [gps]);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    let magSub;
    let locSub;

    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      console.log("Location permission:", perm.status);

      setLocPerm(perm.status === "granted");
      if (perm.status !== "granted") return;

      // Location updates
      locSub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 1000,
          distanceInterval: 0,
        },
        (pos) => {
          const nextGps = {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            ts: Date.now(),
          };
          // console.log("GPS:", nextGps);
          setGps(nextGps);
        },
      );

      // Magnetometer
      Magnetometer.setUpdateInterval(100);
      magSub = Magnetometer.addListener((data) => {
        const nextMag = { ...data, ts: Date.now() };
        // console.log("MAG:", nextMag);
        setMag(nextMag);
      });
    })();

    return () => {
      magSub && magSub.remove();
      locSub && locSub.remove();
    };
  }, []);

  // ---- Send to backend every 2 seconds (interval runs ONCE) ----
  useEffect(() => {
    if (!locPerm) return;

    const intervalMs = 2000;

    const id = setInterval(async () => {
      const magNow = magRef.current;
      const gpsNow = gpsRef.current;
      const roomNow = roomRef.current;

      console.log("TICK", {
        mag: { x: magNow.x, y: magNow.y, z: magNow.z },
        gps: { lat: gpsNow.lat, lon: gpsNow.lon },
        room: roomNow,
      });

      if (
        inFlight.current ||
        magNow.x == null ||
        magNow.y == null ||
        magNow.z == null ||
        gpsNow.lat == null ||
        gpsNow.lon == null
      ) {
        return;
      }

      inFlight.current = true;

      try {
        const payload = {
          room: roomNow,
          mag: { x: magNow.x, y: magNow.y, z: magNow.z, ts: magNow.ts },
          gps: { lat: gpsNow.lat, lon: gpsNow.lon, ts: gpsNow.ts },
        };

        const res = await fetch("http://10.46.26.13:8000/predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        console.log("predict response:", res.status, data);

        if (
          res.ok &&
          typeof data?.x === "number" &&
          typeof data?.y === "number"
        ) {
          const imgSrc = Image.resolveAssetSource(
            require("../assets/ground_floor.png"),
          );
          const ORIGINAL_W = imgSrc.width;
          const ORIGINAL_H = imgSrc.height;

          const scaleX = imgLayout.w / ORIGINAL_W;
          const scaleY = imgLayout.h / ORIGINAL_H;

          const x = data.x * scaleX;
          const y = data.y * scaleY;

          setMarker({ x, y });
        }
      } catch (e) {
        console.log("send failed", e);
      } finally {
        inFlight.current = false;
      }
    }, intervalMs);

    return () => clearInterval(id);
  }, [locPerm]);

  const markerPx = useMemo(() => {
    if (!marker || imgLayout.w === 0 || imgLayout.h === 0) return null;
    return {
      x: marker.x,
      y: marker.y,
    };
  }, [marker, imgLayout]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View>
        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Pressable style={styles.iconbtn}>
            <Ionicons name="menu" size={22} color="#111827" />
          </Pressable>

          <View style={styles.searchText}>
            <TextInput
              style={styles.searchInput}
              placeholder="Where can I take you?"
              value={room}
              onChangeText={setRoom}
            />
          </View>
        </View>

        {/* Map */}
        <View style={styles.mapCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <ReactNativeZoomableView
                maxZoom={3}
                minZoom={1}
                zoomStep={0.5}
                initialZoom={1}
              >
                {/* Wrapper that defines overlay coordinate space */}
                <View
                  onLayout={(e) => {
                    const { width, height } = e.nativeEvent.layout;
                    setImgLayout({ w: width, h: height });
                  }}
                >
                  <Image
                    source={require("../assets/ground_floor.png")}
                    style={styles.mapImage}
                    resizeMode="contain"
                  />

                  {/* Overlay marker */}
                  {markerPx && (
                    <Svg
                      width={imgLayout.w}
                      height={imgLayout.h}
                      style={StyleSheet.absoluteFill}
                    >
                      <Circle
                        cx={markerPx.x}
                        cy={markerPx.y}
                        r={10}
                        fill="red"
                      />
                      <Circle
                        cx={markerPx.x}
                        cy={markerPx.y}
                        r={18}
                        fill="rgba(255,0,0,0.25)"
                      />
                    </Svg>
                  )}
                </View>
              </ReactNativeZoomableView>
            </ScrollView>
          </ScrollView>
        </View>

        {/* Optional debug to see marker values */}
        {/* <Text>{marker ? `Marker: ${marker.x.toFixed(2)}, ${marker.y.toFixed(2)}` : "No marker yet"}</Text> */}
      </View>
    </SafeAreaView>
  );
};

export default Home;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#CAD1DF" },

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
  searchText: { flex: 1, paddingHorizontal: 10 },
  searchInput: { fontSize: 18, fontWeight: "500", color: "#111827" },

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
    marginTop: 16,
  },

  mapImage: {
    width: 340,
    height: 500,
  },
});
