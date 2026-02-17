import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  Pressable,
  Image,
  ScrollView,
  TextInput,
} from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { ReactNativeZoomableView } from "@openspacelabs/react-native-zoomable-view";
import { Magnetometer } from "expo-sensors";
import * as Location from "expo-location";
import { Picker } from "@react-native-picker/picker";

const DISPLAY_W = 340;
const DISPLAY_H = 500;

const FLOORS = [
  {
    label: "Ground Floor",
    value: 0,
    img: require("../assets/ground_floor.png"),
  },
  { label: "1st Floor", value: 1, img: require("../assets/first_floor.png") },
  { label: "2nd Floor", value: 2, img: require("../assets/second_floor.png") },
  { label: "3rd Floor", value: 3, img: require("../assets/third_floor.png") },
];

export default function Home() {
  const [locPerm, setLocPerm] = useState(false);
  const [mag, setMag] = useState({ x: null, y: null, z: null, ts: null });
  const [gps, setGps] = useState({ lat: null, lon: null, ts: null });

  const [room, setRoom] = useState("");
  const [floor, setFloor] = useState(null);

  const [marker, setMarker] = useState(null);

  const [path, setPath] = useState(null); //meghs
  const [goal, setGoal] = useState(null); //meghs
  const [phase, setPhase] = useState(null); // meghs
  const [targetFloor, setTargetFloor] = useState(null); //meghs

  const [event, setevent] = useState();

  const inFlight = useRef(false);

  const magRef = useRef(mag);
  const gpsRef = useRef(gps);
  const roomRef = useRef(room);
  const floorRef = useRef(floor);

  const today = new Date().toISOString().split("T")[0];

  const EVENTS_BY_DATE = {
    "2026-02-17": [
      { label: "The MERN Playbook", value: "The MERN Playbook" },
      {
        label: "Game Development with Godot",
        value: "Game Development with Godot",
      },
      { label: "Mind Heist", value: "Mind Heist" },
      { label: "Doomsday:Protocol", value: "Doomsday:Protocol" },
      { label: "Pixel Paradox", value: "Pixel Paradox" },
    ],

    "2026-02-18": [
      { label: "Flutter Fast", value: "Flutter Fast" },
      { label: "GenAI Systems", value: "GenAI Systems" },
      { label: "Design and Decode", value: "Design and Decode" },
      { label: "CrackNCode", value: "CrackNCode" },
    ],
  };

  const todaysEvents = EVENTS_BY_DATE[today] ?? [];

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
    floorRef.current = floor;
  }, [floor]);

  // Optional: reset marker when floor changes
  useEffect(() => {
    setMarker(null);
  }, [floor]);

  useEffect(() => {
    // meghs
    if (floor === targetFloor) {
      setPhase("room");
    }
  }, [floor]);

  // --- Sensors setup ---
  useEffect(() => {
    let magSub;
    let locSub;

    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      console.log("Location permission:", perm.status);

      const granted = perm.status === "granted";
      setLocPerm(granted);
      if (!granted) return;

      locSub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 1000,
          distanceInterval: 0,
        },
        (pos) => {
          setGps({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            ts: Date.now(),
          });
        },
      );

      Magnetometer.setUpdateInterval(100);
      magSub = Magnetometer.addListener((data) => {
        setMag({ ...data, ts: Date.now() });
      });
    })();

    return () => {
      magSub && magSub.remove();
      locSub && locSub.remove();
    };
  }, []);

  const handleFloorChange = (newFloor) => {
    setFloor(newFloor);

    // clear stale navigation state
    setMarker(null);
    setPath(null);
    setGoal(null);
    setPhase(null);
    setTargetFloor(null);
  };
  // --- Send to backend every 2 seconds ---
  useEffect(() => {
    if (!locPerm) return;

    const intervalMs = 2000;

    const id = setInterval(async () => {
      const magNow = magRef.current;
      const gpsNow = gpsRef.current;
      const roomNow = roomRef.current;
      const floorNow = floorRef.current;

      if (
        inFlight.current ||
        floorNow === null ||
        magNow.x == null ||
        !roomNow || // meghs
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
          floor: floorNow,
          room: roomNow,
          mag: { x: magNow.x, y: magNow.y, z: magNow.z, ts: magNow.ts },
          gps: { lat: gpsNow.lat, lon: gpsNow.lon, ts: gpsNow.ts },
        };

        console.log("TICK payload:", payload);

        const res = await fetch(
          "https://sdc2.psgitech.ac.in/yuktanav/navigate", // meghs
          //"http://10.157.205.13:8000/predict",
          //"https://sdc2.psgitech.ac.in/yuktanav/predict",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );

        const text = await res.text();
        console.log("predict response:", res.status, text);

        if (!res.ok) return;

        const data = JSON.parse(text);

        if (data?.ok) {
          // Use the image of the current floor to compute scaling
          setPhase(data.phase); // meghs
          setTargetFloor(data.target_floor); //meghs

          const selected = FLOORS.find((f) => f.value === floorNow);
          const imgSrc = Image.resolveAssetSource(selected.img);

          const ORIGINAL_W = imgSrc.width;
          const ORIGINAL_H = imgSrc.height;

          const scaleX = DISPLAY_W / ORIGINAL_W;
          const scaleY = DISPLAY_H / ORIGINAL_H;

          setMarker({
            x: data.current[0] * scaleX, // meghs
            y: data.current[1] * scaleY,
          });
          /* setMarker({
            x: data.x * scaleX,
            y: data.y * scaleY,
          }); */

          setGoal({
            // meghs
            x: data.goal[0] * scaleX,
            y: data.goal[1] * scaleY,
          });

          const scaledPath = data.path.map(([x, y]) => ({
            // meghs
            x: x * scaleX,
            y: y * scaleY,
          }));

          setPath(scaledPath); // meghs
        }
      } catch (e) {
        console.log("send failed", e);
      } finally {
        inFlight.current = false;
      }
    }, intervalMs);

    return () => clearInterval(id);
  }, [locPerm]);

  // --- Floor selection prompt ---
  if (floor === null) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.floorPrompt}>
          <Text style={styles.promptTitle}>
            Which floor are you currently in?
          </Text>

          {FLOORS.map((f) => (
            <Pressable
              key={f.value}
              style={styles.floorButton}
              // onPress={() => setFloor(f.value)}
              onPress={() => handleFloorChange(f.value)}
            >
              <Text style={styles.floorButtonText}>{f.label}</Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  const selectedFloor = FLOORS.find((f) => f.value === floor);
  const floorImage = selectedFloor.img;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View>
        {/* Search Bar */}
        {/* {<View style={styles.searchBar}>
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
        </View> */}

        <View style={{ paddingHorizontal: 16, marginTop: 10 }}>
          <Text style={{ fontWeight: "700", marginBottom: 6 }}>
            Events Today ({today})
          </Text>

          {todaysEvents.length === 0 ? (
            <Text style={{ color: "red" }}>No events scheduled for today.</Text>
          ) : (
            <View style={{ backgroundColor: "white", borderRadius: 12 }}>
              <Picker
                selectedValue={event}
                onValueChange={(val) => {
                  setRoom(val);
                }}
              >
                {todaysEvents.map((e) => (
                  <Picker.Item key={e.value} label={e.label} value={e.value} />
                ))}
              </Picker>
            </View>
          )}
        </View>

        {/* meghs */}
        {phase === "stairs" && targetFloor !== null && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              Go to Floor {targetFloor} using stairs
            </Text>
          </View>
        )}

        {/* Floor switcher */}
        <View style={styles.floorSwitcher}>
          {FLOORS.map((f) => (
            <Pressable
              key={f.value}
              onPress={() => handleFloorChange(f.value)}
              style={[
                styles.floorTab,
                floor === f.value && styles.floorTabActive,
              ]}
            >
              <Text style={styles.floorTabText}>{f.label}</Text>
            </Pressable>
          ))}
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
                {/* Coordinate space wrapper */}
                <View style={{ width: DISPLAY_W, height: DISPLAY_H }}>
                  <Image
                    source={floorImage}
                    style={{ width: DISPLAY_W, height: DISPLAY_H }}
                    resizeMode="stretch"
                  />

                  {/* PATH DRAWING meghs*/}
                  {path &&
                    path.map((point, index) => {
                      if (index === path.length - 1) return null;
                      const next = path[index + 1];
                      return (
                        <View
                          key={index}
                          pointerEvents="none"
                          style={{
                            position: "absolute",
                            left: Math.min(point.x, next.x),
                            top: Math.min(point.y, next.y),
                            width: Math.abs(point.x - next.x) || 3,
                            height: Math.abs(point.y - next.y) || 3,
                            backgroundColor: "blue",
                          }}
                        />
                      );
                    })}

                  {/* GOAL MARKER meghs */}
                  {goal && (
                    <View
                      pointerEvents="none"
                      style={{
                        position: "absolute",
                        left: goal.x - 10,
                        top: goal.y - 10,
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: "green",
                      }}
                    />
                  )}

                  {/* Marker: child of zoomed content -> stays aligned on zoom/pan */}
                  {marker && (
                    <View
                      pointerEvents="none"
                      style={{
                        position: "absolute",
                        left: marker.x - 10,
                        top: marker.y - 10,
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: "red",
                      }}
                    />
                  )}
                </View>
              </ReactNativeZoomableView>
            </ScrollView>
          </ScrollView>
        </View>

        {/* Debug */}
        {/* <Text>{marker ? `Marker: ${marker.x.toFixed(1)}, ${marker.y.toFixed(1)}` : "No marker yet"}</Text> */}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#CAD1DF" },

  banner: {
    // meghs
    backgroundColor: "#facc15",
    padding: 10,
    marginTop: 10,
    borderRadius: 10,
    alignSelf: "center",
  },
  bannerText: { fontWeight: "600" }, // meghs

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

  floorPrompt: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  promptTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 20,
    textAlign: "center",
  },
  floorButton: {
    backgroundColor: "#2563eb",
    padding: 14,
    width: "85%",
    borderRadius: 14,
    marginVertical: 8,
  },
  floorButtonText: {
    color: "white",
    fontSize: 18,
    textAlign: "center",
  },

  floorSwitcher: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 10,
    flexWrap: "wrap",
    paddingHorizontal: 10,
  },
  floorTab: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginHorizontal: 4,
    marginVertical: 4,
    borderRadius: 10,
    backgroundColor: "#e5e7eb",
  },
  floorTabActive: {
    backgroundColor: "#2563eb",
  },
  floorTabText: {
    fontSize: 12,
    color: "#111827",
  },
});
