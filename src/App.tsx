import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import SettingsPage from './pages/Settings';
import { LevelRoadmap } from "./pages/LevelRoadmap";
import Home from './pages/Home';
import PrivacyPage from './pages/legal/PrivacyPage';
import TermsPage from './pages/legal/TermsPage';
import { AboutPage, SafetyPage, HelpPage, ContactPage } from './pages/InfoPages';
import { Trophy, Coffee as CoffeeIcon } from "lucide-react";
import {
  User,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";
import {
  collection,
  onSnapshot,
  query,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  where,
} from "firebase/firestore";
import {
  auth,
  db,
  handleFirestoreError,
  logOut,
  OperationType,
} from "./firebase";
import ChatInterface, { ChatInboxList } from "./components/ChatInterface";
import ItemDetail from "./components/ItemDetail";
import { Item, Claim, Category } from "./types";
import { ClaimSubmissionForm } from "./components/claims/ClaimSubmissionForm";
import { ClaimReviewView } from "./components/claims/ClaimReviewView";
import { MyClaimsView } from "./components/claims/MyClaimsView";
import { ReportDetailsStep } from "./components/report/ReportDetailsStep";
import { ReportVerificationStep } from "./components/report/ReportVerificationStep";
import { useIncomingClaims, useMyClaims, markClaimAsRead } from "./lib/claims";
import {
  ShieldCheck,
  Search,
  Lock,
  UserPlus,
  ArrowRight,
  Tag,
  Lightbulb,
  Key,
  Smartphone,
  Home as HomeIcon,
  Package,
  Bell,
  User as UserIcon,
  MapPin,
  CheckCircle2,
  Info,
  Navigation,
  Hand,
  Inbox,
  PenTool,
  Camera,
  MessageCircle,
  Mail,
  Eye,
  EyeOff,
  Dices,
  Save,
  LogOut,
  Send,
  Zap,
  CheckSquare,
  X,
  ShoppingBag,
  MapIcon,
  Users,
  FileSearch,
  MessageSquareHeart,
  PackageCheck,
  PlusCircle,
  Quote,
  Handshake,
  Filter,
  Clock,
  Menu, Grid,
  Archive, Pin, Shapes, BarChart2, HeartHandshake, HelpCircle,
  ArrowLeft, Share, Bot, RefreshCw, BadgeCheck, MessageSquare, Gavel, Shield , Scan , Settings , AlertTriangle, Star, Heart, TrendingUp, ArrowDownUp, FileText, Image as ImageIcon, LogIn, Trash2 } from "lucide-react"
import { uploadToCloudinary } from "./lib/cloudinary";

interface ItemReport {
  id: string;
  userId: string;
  title: string;
  location: string;
  desc?: string;
  description?: string;
  type: "lost" | "found";
  image?: string;
  imageUrl?: string;
  createdAt: any;
  claimed: boolean;
}

const ONBOARD_STEPS = [
  {
    icon: <Search className="text-white h-12 w-12" />,
    label: "Step 1 of 4",
    title: "Welcome to FindTrack!",
    desc: "Your lost & found platform. Report missing items, search for found ones, and get reunited with your belongings — fast.",
  },
  {
    icon: <Package className="text-white h-12 w-12" />,
    label: "Step 2 of 4",
    title: "Report Lost or Found Items",
    desc: "Tap the Report tab to submit an item. Add a photo, title, and location for the best chance of recovery. The more detail, the better!",
  },
  {
    icon: <CheckCircle2 className="text-white h-12 w-12" />,
    label: "Step 3 of 4",
    title: "Smart Match Suggestions",
    desc: "Our smart system automatically compares your reports against others and highlights possible matches — so you can claim your item faster.",
  },
  {
    icon: <MapPin className="text-white h-12 w-12" />,
    label: "Step 4 of 4",
    title: "Pin & Track Items",
    desc: "Bookmark items you're watching with the pin button. Check Pinned Items in the menu for quick access anytime. You're all set — good luck!",
  },
];

export default function App() {
  const { t, i18n } = useTranslation();

  // Navigation layout state: 'landing' | 'login' | 'signup' | 'dashboard' | 'verify-email' | 'privacy' | 'terms' | 'verification-success'
  const [currentView, setCurrentView] = useState<
    | "landing"
    | "login"
    | "signup"
    | "dashboard"
    | "verify-email"
    | "privacy"
    | "terms"
    | "verification-success"
  >(() => {
    const path = window.location.pathname;
    if (path === "/privacy") return "privacy";
    if (path === "/terms") return "terms";
    return "landing";
  });

  // Dashboard panel selector
  const [activeTab, setActiveTab] = useState<string>("home");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Authentication & session state
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState<boolean>(true);

  // Form input validations / fields
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPass] = useState("");
  const [signupFirst, setSignupFirst] = useState("");
  const [signupLast, setSignupLast] = useState("");
  const [signupContact, setSignupContact] = useState("");

  // App alerts, loading states & real-time sync list
  const [items, setItems] = useState<ItemReport[]>([]);
  const [newMatchesNotif, setNewMatchesNotif] = useState<boolean>(true);
  const [communityAlertsNotif, setCommunityAlertsNotif] = useState<boolean>(true);
  const incomingClaims = useIncomingClaims(auth.currentUser?.uid);
  const activeIncomingClaims = useMemo(() => {
    return newMatchesNotif ? incomingClaims : [];
  }, [newMatchesNotif, incomingClaims]);
  const myClaims = useMyClaims(auth.currentUser?.uid);
  
  // Dynamic Points and Level Calculation for current user to keep synchronized
  const currentUserPointsAndLevel = useMemo(() => {
    if (!auth.currentUser?.uid) return { points: 0, level: 1 };
    const reports = items.filter((i) => i.userId === auth.currentUser?.uid).length;
    const reunited = items.filter((i) => i.userId === auth.currentUser?.uid && i.claimed).length;
    const points = (reports * 15) + (reunited * 50);
    let level = 1;
    if (points >= 500) level = 5;
    else if (points >= 250) level = 4;
    else if (points >= 120) level = 3;
    else if (points >= 45) level = 2;
    return { points, level };
  }, [items, auth.currentUser?.uid]);

  const [toasts, setToasts] = useState<
    { id: string; msg: string; type: "success" | "error" }[]
  >([]);
  const [landingMenuOpen, setLandingMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [confetti, setConfetti] = useState<any[]>([]);

  useEffect(() => {
    if (currentView === "verification-success") {
      const colors = ["#9af4d6", "#01725a", "#fab83f", "#b5eedb"];
      const pieces = Array.from({ length: 50 }).map((_, i) => ({
        id: i,
        color: colors[Math.floor(Math.random() * colors.length)],
        left: `${Math.random() * 100}%`,
        duration: `${Math.random() * 3 + 2}s`,
        delay: `${Math.random() * 2}s`,
      }));
      setConfetti(pieces);
    } else {
      setConfetti([]);
    }
  }, [currentView]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(
        () => setResendCooldown(resendCooldown - 1),
        1000,
      );
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardStep, setOnboardStep] = useState(0);
  const [zoomImg, setZoomImg] = useState<string | null>(null);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestBannerDismissed, setGuestBannerDismissed] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
// My Items Tab
  const [myItemsTab, setMyItemsTab] = useState<'items' | 'claims'>('items');

  // Dashboard inputs
  const [reportStep, setReportStep] = useState(1);
  const [reportTitle, setReportTitle] = useState("");
  const [reportLocation, setReportLocation] = useState("");
  const [reportDesc, setReportDesc] = useState("");
  const [reportEmail, setReportEmail] = useState("");
  const [reportType, setReportType] = useState<"lost" | "found">("lost");
  const [reportCategory, setReportCategory] = useState<Category>("others");
  const [reportDate, setReportDate] = useState("");
  const [reportColor, setReportColor] = useState("");
  const [reportImage, setReportImage] = useState<string>("");
  const [reportImageFile, setReportImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [reportSecurityQuestion, setReportSecurityQuestion] = useState("");
  const [reportSecurityAnswer, setReportSecurityAnswer] = useState("");

  // Dashboard Search state
  const [sQuery, setSQuery] = useState("");
  const [sFilter, setSFilter] = useState("all");
  const [sLoc, setSLoc] = useState("");
  const [sDate, setSDate] = useState("");
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);

  // Category browse keyword lists
  const [categoryKeywords, setCategoryKeywords] = useState<string[] | null>(
    null,
  );

  // Profile data
  const [profileName, setProfileName] = useState("Student");
  const [profileLocation, setProfileLocation] = useState("");
  const [profileBio, setProfileBio] = useState("");

  const [selectedReviewClaim, setSelectedReviewClaim] = useState<Claim | null>(null);

  const markAlertRead = (id: string) => markClaimAsRead(id);
  const markAllAlertsRead = () => {
    activeIncomingClaims.filter(c => !c.isReadByFinder).forEach(c => markClaimAsRead(c.id));
  };

  const [profileEmail, setProfileEmail] = useState("");
  const [profileContact, setProfileContact] = useState("");
  const [profileAvatar, setProfileAvatar] = useState("");

  // Pinned item list IDs (local storage synchronization)
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

  // Shimmer skeleton state
  const [homeShimmer, setHomeShimmer] = useState(true);

  // Donut chart canvas reference
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Trigger custom toast notification
  const triggerToast = (msg: string, type: "success" | "error" = "success") => {
    const id = Math.random().toString();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3300);
  };

  const handleBackToSafety = () => {
    if (auth.currentUser) {
      if (auth.currentUser.email && !auth.currentUser.emailVerified) {
        setCurrentView("verify-email");
        window.history.pushState(null, "", "/verify-email");
      } else {
        setCurrentView("dashboard");
        window.history.pushState(null, "", "/");
      }
    } else {
      try {
        const guestSession = localStorage.getItem("sessionUser");
        if (guestSession) {
          const session = JSON.parse(guestSession);
          if (session && session.email === "") {
            setCurrentView("dashboard");
            window.history.pushState(null, "", "/");
            return;
          }
        }
      } catch (e) {
        console.error(e);
      }
      setCurrentView("landing");
      window.history.pushState(null, "", "/");
    }
  };

  const goToLanding = () => {
    setCurrentView("landing");
    window.history.pushState(null, "", "/");
  };

  // Check login session
  const isLoggedIn = useMemo(() => {
    return user !== null;
  }, [user]);

  // 1. Listen to Authentication State Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);

      if (currentUser) {
        // Automatically sync initial profile credentials
        setProfileEmail(currentUser.email || "");

        // Sync profile data from localStorage context if exists
        try {
          const lProfile = localStorage.getItem("userProfile");
          if (lProfile) {
            const parsed = JSON.parse(lProfile);
            if (parsed.name && parsed.name !== "Guest") {
              setProfileName(parsed.name);
            } else {
              setProfileName(
                currentUser.displayName ||
                  currentUser.email?.split("@")[0] ||
                  "User",
              );
            }
            if (parsed.contact) setProfileContact(parsed.contact);
            if (parsed.location) setProfileLocation(parsed.location);
            if (parsed.bio) setProfileBio(parsed.bio);
            if (parsed.avatar && !parsed.avatar.includes("guest") && !parsed.avatar.includes("dicebear.com")) {
              setProfileAvatar(parsed.avatar);
            } else {
              setProfileAvatar("");
            }
          } else {
            setProfileName(
              currentUser.displayName ||
                currentUser.email?.split("@")[0] ||
                "User",
            );
          }
        } catch (e) {
          console.error(e);
        }

        // Fetch/sync user settings from Firestore database
        const userDocRef = doc(db, "users", currentUser.uid);
        getDoc(userDocRef).then((docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.name) setProfileName(data.name);
            if (data.contact) setProfileContact(data.contact);
            if (data.location) setProfileLocation(data.location);
            if (data.bio) setProfileBio(data.bio);
            if (data.avatar && !data.avatar.includes("dicebear.com")) {
              setProfileAvatar(data.avatar);
            } else {
              setProfileAvatar("");
            }
            if (data.newMatchesNotif !== undefined) setNewMatchesNotif(data.newMatchesNotif);
            if (data.communityAlertsNotif !== undefined) setCommunityAlertsNotif(data.communityAlertsNotif);
          } else {
            // First time login - create database record
            const initialData = {
              name: currentUser.displayName || currentUser.email?.split("@")[0] || "User",
              email: currentUser.email || "",
              contact: "",
              location: "",
              bio: "",
              avatar: "",
              newMatchesNotif: true,
              communityAlertsNotif: true,
              createdAt: new Date().toISOString()
            };
            setDoc(userDocRef, initialData).catch(console.error);
          }
        }).catch((err) => {
          console.error("Failed to fetch user settings from Firestore:", err);
        });

        // Block unverified email users from accessing protected views (dashboard)
        const path = window.location.pathname;
        if (["/privacy", "/terms", "/about", "/safety", "/help", "/contact"].includes(path)) {
          setCurrentView(path.slice(1) as any);
        } else if (currentUser.email && !currentUser.emailVerified) {
          setCurrentView("verify-email");
        } else {
          // Force token refresh on load to prevent stale email_verified claims from breaking rules
          if (currentUser.emailVerified) {
            currentUser.getIdToken(true).catch(console.error);
          }
          // Switch view to dashboard on successful load
          setCurrentView("dashboard");
        }
      } else {
        // If guest is currently in session, direct to dashboard
        try {
          const guestSession = localStorage.getItem("sessionUser");
          if (guestSession) {
            const session = JSON.parse(guestSession);
            if (session && session.email === "") {
              setProfileName("Guest");
              setProfileEmail("");
              const path = window.location.pathname;
              if (["/privacy", "/terms", "/about", "/safety", "/help", "/contact"].includes(path)) {
                setCurrentView(path.slice(1) as any);
              } else {
                setCurrentView("dashboard");
              }
            }
          }
        } catch (e) {
          console.error(e);
        }
      }
    });

    // Sync Pinned Items
    try {
      const pins = localStorage.getItem("pinnedItems");
      if (pins) {
        setPinnedIds(JSON.parse(pins));
      }
    } catch (e) {
      console.error(e);
    }

    return unsubscribe;
  }, []);

  // Handle browser back/forward buttons (routing sync)
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === "/privacy") {
        setCurrentView("privacy");
      } else if (path === "/terms") {
        setCurrentView("terms");
      } else if (path === "/login") {
        setCurrentView("login");
      } else if (path === "/signup") {
        setCurrentView("signup");
      } else if (path === "/" || path === "") {
        if (auth.currentUser) {
          if (auth.currentUser.email && !auth.currentUser.emailVerified) {
            setCurrentView("verify-email");
          } else {
            setCurrentView("dashboard");
          }
        } else {
          setCurrentView("landing");
        }
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [user]);

  // 1.5. Automatic email verification polling when on verify-email view
  useEffect(() => {
    if (currentView !== "verify-email") return;

    const interval = setInterval(async () => {
      try {
        if (auth.currentUser) {
          await auth.currentUser.reload();
          if (auth.currentUser.emailVerified) {
            await auth.currentUser.getIdToken(true);
            triggerToast("✅ Email verified automatically!", "success");
            setCurrentView("verification-success");
          }
        }
      } catch (e) {
        console.error("Auto verification check failed:", e);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [currentView, user]);

  // 2. Real-time Firestore Sync of items / reports
  useEffect(() => {
    const reportsCollection = collection(db, "items"); // Rules define items matching

    // Listen to all public lost/found entries across the board to permit comprehensive lost and found search engine matching
    const unsubscribe = onSnapshot(
      query(reportsCollection),
      (snapshot) => {
        const list: ItemReport[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as ItemReport);
        });
        // Sort in-memory descending creation date
        list.sort((a, b) => {
          const aTime = a.createdAt?.seconds
            ? a.createdAt.seconds * 1000
            : new Date(a.createdAt || 0).getTime();
          const bTime = b.createdAt?.seconds
            ? b.createdAt.seconds * 1000
            : new Date(b.createdAt || 0).getTime();
          return bTime - aTime;
        });
        setItems(list);
        setHomeShimmer(false);
      },
      (error) => {
        console.error("Firestore sync error:", error);
      },
    );

    return unsubscribe;
  }, []);



  // Safeguard: Block unverified users from accessing protected views (dashboard) and redirect them to verify screen
  useEffect(() => {
    if (
      auth.currentUser &&
      auth.currentUser.email &&
      !auth.currentUser.emailVerified &&
      currentView === "dashboard"
    ) {
      setCurrentView("verify-email");
    }
  }, [currentView, user]);

  // 3. Initiate Onboarding trigger
  useEffect(() => {
    if (currentView === "dashboard") {
      const isComplete = localStorage.getItem("ft_onboarded");
      if (!isComplete) {
        const timer = setTimeout(() => {
          setShowOnboarding(true);
        }, 1100);
        return () => clearTimeout(timer);
      }
    }
  }, [currentView]);

  // Handle Firebase Sign In
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loadingAuth) return;
    if (!authEmail || !authPassword) {
      triggerToast("❌ Please enter your email and password.", "error");
      return;
    }

    setLoadingAuth(true);
    try {
      const credentials = await signInWithEmailAndPassword(
        auth,
        authEmail.trim(),
        authPassword,
      );
      localStorage.setItem(
        "sessionUser",
        JSON.stringify({
          id: credentials.user.uid,
          email: credentials.user.email,
        }),
      );
      triggerToast("✅ Login successful! Redirecting...", "success");
      setAuthEmail("");
      setAuthPass("");
      if (credentials.user.email && !credentials.user.emailVerified) {
        setCurrentView("verify-email");
      } else {
        setCurrentView("dashboard");
      }
    } catch (err: any) {
      console.error("SignIn error:", err);
      if (
        err.message?.includes("requests-from-referer") ||
        err.code?.includes("requests-from-referer")
      ) {
        triggerToast("❌ Firebase error: " + (err?.code || "unknown"), "error");
      } else if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password"
      ) {
        triggerToast(
          "❌ Invalid email or password. Please try again.",
          "error",
        );
      } else {
        triggerToast(
          "❌ Login failed: " +
            (err.message || err.code || "Please try again."),
          "error",
        );
      }
    } finally {
      setLoadingAuth(false);
    }
  };

  // Handle Firebase Sign Up
  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loadingAuth) return;
    if (!signupFirst.trim() || !signupLast.trim()) {
      triggerToast("❌ First and Last names are required.", "error");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(authEmail.trim())) {
      triggerToast("❌ Please enter a valid email address.", "error");
      return;
    }
    if (authPassword.length < 6) {
      triggerToast("❌ Password must be at least 6 characters.", "error");
      return;
    }

    setLoadingAuth(true);
    try {
      const credentials = await createUserWithEmailAndPassword(
        auth,
        authEmail.trim().toLowerCase(),
        authPassword,
      );
      const fullName = `${signupFirst.trim()} ${signupLast.trim()}`;

      localStorage.setItem(
        "sessionUser",
        JSON.stringify({
          id: credentials.user.uid,
          name: fullName,
          email: authEmail.trim().toLowerCase(),
        }),
      );

      const prof = {
        name: fullName,
        email: authEmail.trim().toLowerCase(),
        contact: signupContact.trim(),
        avatar: profileAvatar,
      };
      localStorage.setItem("userProfile", JSON.stringify(prof));

      setProfileName(fullName);
      setProfileContact(signupContact);
      setProfileEmail(authEmail.trim().toLowerCase());

      // Automatically send a verification email using Firebase sendEmailVerification()
      try {
        const actionCodeSettings = {
          url: window.location.origin,
          handleCodeInApp: false,
        };
        await sendEmailVerification(credentials.user, actionCodeSettings);
        triggerToast(
          "✅ Account created! Please check your email to verify.",
          "success",
        );
      } catch (err: any) {
        console.error("Verification email sending failed:", err);
        triggerToast(
          "❌ Account created, but email verification failed to send. Try resending.",
          "error",
        );
      }

      setSignupFirst("");
      setSignupLast("");
      setSignupContact("");
      setAuthEmail("");
      setAuthPass("");
      setCurrentView("verify-email");
    } catch (err: any) {
      console.error("SignUp error:", err);
      if (err.code === "auth/email-already-in-use") {
        triggerToast("❌ Email already registered.", "error");
      } else if (
        err.message?.includes("requests-from-referer") ||
        err.code?.includes("requests-from-referer")
      ) {
        triggerToast("❌ Firebase error: " + (err?.code || "unknown"), "error");
      } else {
        triggerToast(
          "❌ Signup failed: " + (err.message || err.code || "Try again."),
          "error",
        );
      }
    } finally {
      setLoadingAuth(false);
    }
  };

  // Handle Logout
  const handleLogoutAction = async () => {
    localStorage.removeItem("sessionUser");
    localStorage.removeItem("userProfile");
    try {
      await logOut();
    } catch (er) {
      console.error(er);
    }
    setProfileName("");
    setProfileEmail("");
    setProfileContact("");
    setUser(null);
    triggerToast("Signed out successfully.", "success");
    setCurrentView("landing");
    setActiveTab("home");
  };

  // Browse as guest fallback trigger
  const handleGuestBrowse = () => {
    localStorage.removeItem("sessionUser");
    const guestUser = {
      name: "Guest",
      email: "",
      contact: "",
      avatar: "",
    };
    localStorage.setItem("userProfile", JSON.stringify(guestUser));
    localStorage.setItem(
      "sessionUser",
      JSON.stringify({ id: "guest_" + Date.now(), email: "" }),
    );
    setProfileName("Guest");
    setProfileEmail("");
    setProfileContact("");
    setProfileAvatar(guestUser.avatar);
    setCurrentView("dashboard");
    setActiveTab("home");
  };

  // Save profile modifications
  const handleSaveProfile = async () => {
    if (profileName === "Guest") {
      setShowGuestModal(true);
      return;
    }

    const updated = {
      name: profileName,
      email: profileEmail,
      contact: profileContact,
      avatar: profileAvatar,
      location: profileLocation,
      bio: profileBio,
    };
    localStorage.setItem("userProfile", JSON.stringify(updated));

    if (auth.currentUser) {
      try {
        const userDocRef = doc(db, "users", auth.currentUser.uid);
        await setDoc(userDocRef, {
          ...updated,
          newMatchesNotif,
          communityAlertsNotif,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        triggerToast("Profile saved successfully!", "success");
      } catch (err) {
        console.error("Failed to save profile in database:", err);
        triggerToast("❌ Failed to save changes to database", "error");
      }
    } else {
      triggerToast("Profile saved successfully!", "success");
    }
  };

  // Image upload reading state
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReportImageFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        setReportImage(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Profile avatar trigger random
  const handleRandomAvatar = () => {
    if (profileName === "Guest") {
      setShowGuestModal(true);
      return;
    }
    const seed = Math.random().toString(36).slice(2, 8);
    const styles = ["avataaars", "bottts", "fun-emoji", "lorelei", "pixel-art"];
    const style = styles[Math.floor(Math.random() * styles.length)];
    setProfileAvatar(`https://api.dicebear.com/8.x/${style}/svg?seed=${seed}`);
  };

  // Submit Report to Firestore
  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profileName === "Guest") {
      setShowGuestModal(true);
      return;
    }

    if (!reportTitle.trim()) {
      triggerToast("❌ Item title is required.", "error");
      return;
    }

    setIsUploading(true);
    let finalImageUrl = reportImage || "";

    if (reportImageFile) {
      try {
        finalImageUrl = await uploadToCloudinary(reportImageFile);
      } catch (err) {
        console.error("Cloudinary upload error:", err);
        triggerToast("❌ Failed to upload image.", "error");
        setIsUploading(false);
        return;
      }
    }

    const payloadId =
      "r_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    // Firestore Object Schema aligned with security rules constraints
    const reportData = {
      id: payloadId,
      userId: auth.currentUser?.uid || "anonymous_uid",
      title: reportTitle.trim(),
      description: reportDesc.trim() || "No description provided.",
      type: reportType,
      category: reportCategory, // Supported standard selection
      location: reportLocation.trim() || "Unknown Location",
      status: "active",
      contactName: profileName || "Student",
      contactInfo: `${profileContact || "No contact provided"} | Email: ${reportEmail.trim() || profileEmail || "No email provided"}`,
      date: reportDate || new Date().toISOString(),
      color: reportColor.trim(),
      imageUrl: finalImageUrl,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      claimed: false,
      securityQuestion: reportSecurityQuestion.trim(),
    };

    try {
      await setDoc(doc(db, "items", payloadId), reportData);

      // Save secret verification answer in a separate private collection 'itemSecrets'
      if (reportSecurityAnswer.trim()) {
        await setDoc(doc(db, "itemSecrets", payloadId), {
          itemId: payloadId,
          userId: auth.currentUser?.uid || "anonymous_uid",
          securityAnswer: reportSecurityAnswer.trim().toLowerCase(),
          createdAt: serverTimestamp(),
        });
      }

      triggerToast("✅ Report submitted successfully!", "success");

      // Reset form variables
      setReportTitle("");
      setReportLocation("");
      setReportDesc("");
      setReportEmail("");
      setReportType("lost");
      setReportCategory("others");
      setReportDate("");
      setReportColor("");
      setReportImage("");
      setReportImageFile(null);
      setReportSecurityQuestion("");
      setReportSecurityAnswer("");

      // Auto redirect to home feed out of form
      setActiveTab("home");
    } catch (err) {
      console.error("Firestore creation error:", err);
      triggerToast("❌ Submission rejected by security parameters.", "error");
      try {
        handleFirestoreError(err, OperationType.CREATE, `items/${payloadId}`);
      } catch (e) {}
    } finally {
      setIsUploading(false);
    }
  };

  // Toggle Pin Bookmark action
  const togglePin = (itemId: string) => {
    if (profileName === "Guest") {
      setShowGuestModal(true);
      return;
    }
    let pins = [...pinnedIds];
    const idx = pins.indexOf(itemId);
    if (idx > -1) {
      pins.splice(idx, 1);
      triggerToast("📍 Item unpinned", "success");
    } else {
      pins.push(itemId);
      triggerToast("📌 Item pinned!", "success");
    }
    setPinnedIds(pins);
    localStorage.setItem("pinnedItems", JSON.stringify(pins));
  };

  // Flag Item as Claimed
  const claimItem = async (itemId: string) => {
    if (profileName === "Guest") {
      setShowGuestModal(true);
      return;
    }
    if (
      !confirm("Are you sure you want to mark this item as claimed/recovered?")
    )
      return;

    try {
      await updateDoc(doc(db, "items", itemId), {
        claimed: true,
        status: "resolved",
        updatedAt: serverTimestamp(),
      });
      triggerToast("✅ Item marked as claimed!", "success");
    } catch (err) {
      console.error(err);
      triggerToast("❌ Action access is denied.", "error");
    }
  };

  // Delete Listing report
  const deleteItem = async (itemId: string) => {
    if (profileName === "Guest") {
      setShowGuestModal(true);
      return;
    }

    try {
      // Query for any approved claims on this item
      const claimsRef = collection(db, "claims");
      const q = query(claimsRef, where("itemId", "==", itemId), where("status", "==", "approved"));
      const querySnapshot = await getDocs(q);
      
      let hasApprovedClaim = false;
      let claimantName = "";
      
      if (!querySnapshot.empty) {
        hasApprovedClaim = true;
        const approvedClaimDoc = querySnapshot.docs[0].data() as Claim;
        claimantName = approvedClaimDoc.claimerName || "Someone";
      }

      let confirmed = false;
      if (hasApprovedClaim) {
        confirmed = window.confirm(`This item has already been claimed by ${claimantName}. Are you sure you want to delete it? This cannot be undone and will remove their access to your contact credentials.`);
      } else {
        confirmed = window.confirm(`Are you sure you want to delete this listing? This cannot be undone.`);
      }

      if (!confirmed) return;

      // Delete the main item document
      await deleteDoc(doc(db, "items", itemId));
      
      // Delete from itemSecrets private collection
      try {
        await deleteDoc(doc(db, "itemSecrets", itemId));
      } catch (secErr) {
        console.error("Failed to delete item secrets:", secErr);
      }

      // Clean up orphaned claims pointing to this deleted item
      try {
        const allClaimsQ = query(collection(db, "claims"), where("itemId", "==", itemId));
        const allClaimsSnap = await getDocs(allClaimsQ);
        for (const claimDoc of allClaimsSnap.docs) {
          await deleteDoc(doc(db, "claims", claimDoc.id));
        }
      } catch (claimsCleanErr) {
        console.error("Failed to delete associated claims:", claimsCleanErr);
      }

      setPinnedIds((prev) => prev.filter((id) => id !== itemId));
      triggerToast("🗑️ Item deleted", "error");
      setActiveTab("home"); // Navigate back to Home
    } catch (err) {
      console.error(err);
      triggerToast("❌ Deletion rejected.", "error");
    }
  };

  // Helper actions to approve / reject claims
  
  const handleSubmitClaim = async (itemId: string, finderId: string, securityQuestion: string, providedAnswer: string) => {
    if (!auth.currentUser) return;
    try {
      const claimId = "claim_" + Date.now();
      await setDoc(doc(db, "claims", claimId), {
        itemId,
        finderId,
        claimerId: auth.currentUser.uid,
        securityQuestion,
        providedAnswer,
        status: "pending",
        createdAt: new Date(),
      });
      triggerToast("Claim submitted successfully!", "success");
      setActiveTab("home");
    } catch (error: any) {
      triggerToast("Failed to submit claim", "error");
    }
  };

  const handleApproveClaim = async (claimId: string, itemId: string) => {
    try {
      await updateDoc(doc(db, "claims", claimId), {
        status: "approved",
        updatedAt: serverTimestamp(),
      });
      triggerToast(
        "✅ Ownership claim approved! Access credentials unlocked.",
        "success",
      );
    } catch (err) {
      console.error("Error approving claim:", err);
      triggerToast("❌ Action failed or unauthorized.", "error");
    }
  };

  const handleRejectClaim = async (claimId: string) => {
    try {
      await updateDoc(doc(db, "claims", claimId), {
        status: "rejected",
        updatedAt: serverTimestamp(),
      });
      triggerToast("❌ Claim response declined.", "error");
    } catch (err) {
      console.error("Error rejecting claim:", err);
      triggerToast("❌ Action failed or unauthorized.", "error");
    }
  };

  // Initiate direct chat about item
  const handleStartChat = async (otherUserUid: string, itemId: string) => {
    if (!user) {
      if (profileName === "Guest") {
        setShowGuestModal(true);
      } else {
        setCurrentView("login");
      }
      return;
    }

    if (user.uid === otherUserUid) {
      triggerToast("💡 This is your own listing!", "success");
      return;
    }

    try {
      // Deterministic chat ID
      const chatId = [user.uid, otherUserUid, itemId].sort().join("_");
      const chatRef = doc(db, "chats", chatId);
      const chatSnap = await getDoc(chatRef);

      if (!chatSnap.exists()) {
        const itemRef = doc(db, "items", itemId);
        const itemSnap = await getDoc(itemRef);
        const itemTitle = itemSnap.exists()
          ? itemSnap.data().title
          : "Lost/Found Item";

        await setDoc(chatRef, {
          chatId,
          participants: [user.uid, otherUserUid],
          itemId,
          itemTitle,
          lastMessage: `Convo initiated about "${itemTitle}"`,
          timestamp: serverTimestamp(),
        });
      }

      setActiveChatId(chatId);
    } catch (err) {
      console.error("Error creating chat:", err);
      triggerToast("❌ Failed to initiate chat room.", "error");
    }
  };

  // Active counter statistics dynamic
  const stats = useMemo(() => {
    return {
      lost: items.filter((i) => i.type === "lost" && !i.claimed).length,
      found: items.filter((i) => i.type === "found" && !i.claimed).length,
      claimed: items.filter((i) => i.claimed).length,
    };
  }, [items]);

  // Analytics month and year extractor helper
  const getItemMonthAndYear = (item: ItemReport) => {
    let date: Date | null = null;
    if (item.createdAt) {
      if (typeof item.createdAt.toDate === "function") {
        date = item.createdAt.toDate();
      } else if (typeof item.createdAt.seconds === "number") {
        date = new Date(item.createdAt.seconds * 1000);
      } else {
        date = new Date(item.createdAt);
      }
    }
    
    if (!date || isNaN(date.getTime())) {
      return null;
    }
    return {
      year: date.getFullYear(),
      month: date.getMonth(),
    };
  };

  // Analytics dynamic recovery trends over last 6 months
  const monthlyStats = useMemo(() => {
    const monthsData = [];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthsData.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        name: `${monthNames[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`,
        reported: 0,
        resolved: 0,
      });
    }

    items.forEach((item) => {
      const mInfo = getItemMonthAndYear(item);
      if (!mInfo) return;

      const bucket = monthsData.find(
        (m) => m.year === mInfo.year && m.month === mInfo.month
      );
      if (bucket) {
        bucket.reported++;
        if (item.claimed) {
          bucket.resolved++;
        }
      }
    });

    return monthsData;
  }, [items]);

  // Max value in monthly trend to scale chart height
  const maxChartValue = useMemo(() => {
    let max = 10;
    monthlyStats.forEach((m) => {
      if (m.reported > max) max = m.reported;
      if (m.resolved > max) max = m.resolved;
    });
    return max;
  }, [monthlyStats]);

  // Dynamic Item Categories based on keywords matching
  const categoryStats = useMemo(() => {
    const counts: { [key: string]: { count: number; color: string } } = {
      "Electronics": { count: 0, color: "#01725a" },
      "Wallets & Bags": { count: 0, color: "#336dbe" },
      "Pets": { count: 0, color: "#fab83f" },
      "Documents & Books": { count: 0, color: "#8b5cf6" },
      "Clothing": { count: 0, color: "#ec4899" },
      "Jewelry": { count: 0, color: "#376e5e" },
      "Keys": { count: 0, color: "#f97316" },
      "Others": { count: 0, color: "#64748b" },
    };

    items.forEach((item) => {
      const text = `${item.title} ${item.desc || item.description || ""}`.toLowerCase();
      
      let cat = "Others";
      if (["phone", "laptop", "tablet", "charger", "headphone", "earphone", "computer", "iphone", "samsung", "ipad", "macbook", "gadget", "screen", "wire", "cable"].some(k => text.includes(k))) {
        cat = "Electronics";
      } else if (["bag", "backpack", "purse", "wallet", "luggage", "suitcase", "handbag", "pouch", "cardholder"].some(k => text.includes(k))) {
        cat = "Wallets & Bags";
      } else if (["dog", "cat", "pet", "bird", "animal", "puppy", "kitten", "collar", "leash"].some(k => text.includes(k))) {
        cat = "Pets";
      } else if (["document", "id", "passport", "license", "card", "paper", "folder", "book", "notebook", "national id", "student id", "voter id", "atm"].some(k => text.includes(k))) {
        cat = "Documents & Books";
      } else if (["jacket", "shirt", "pants", "uniform", "shoes", "hat", "scarf", "coat", "clothing", "socks", "cap", "t-shirt"].some(k => text.includes(k))) {
        cat = "Clothing";
      } else if (["ring", "necklace", "bracelet", "watch", "earring", "jewelry", "diamond", "gold", "silver"].some(k => text.includes(k))) {
        cat = "Jewelry";
      } else if (["key", "keychain", "fob", "car key"].some(k => text.includes(k))) {
        cat = "Keys";
      }

      counts[cat].count++;
    });

    const total = items.length;
    return Object.keys(counts).map((key) => {
      const item = counts[key];
      const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
      return {
        name: key,
        count: item.count,
        percentage: pct,
        color: item.color,
      };
    });
  }, [items]);

  // Dynamic Location statistics based on reported location grouping
  const locationStats = useMemo(() => {
    const groups: { [key: string]: { total: number; resolved: number; name: string } } = {};
    items.forEach((item) => {
      let loc = (item.location || "Unknown").trim();
      loc = loc.split(",")[0].trim();
      if (!loc) loc = "General";
      
      const key = loc.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
      
      if (!groups[key]) {
        groups[key] = { total: 0, resolved: 0, name: key };
      }
      groups[key].total++;
      if (item.claimed) {
        groups[key].resolved++;
      }
    });

    return Object.values(groups)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map((g) => {
        const rate = g.total > 0 ? Math.round((g.resolved / g.total) * 100) : 0;
        let trendIcon = "trending_flat";
        let trendColor = "text-on-surface-variant bg-surface-variant";
        let trendText = "0%";
        if (rate >= 75) {
          trendIcon = "trending_up";
          trendColor = "text-primary bg-[#9af4d6]/30";
          trendText = "+5%";
        } else if (rate >= 50) {
          trendIcon = "trending_up";
          trendColor = "text-[#336dbe] bg-[#ccdaee]/30";
          trendText = "+2%";
        } else if (rate < 30 && g.total > 1) {
          trendIcon = "trending_down";
          trendColor = "text-error bg-[#fa746f]/20";
          trendText = "-3%";
        }
        return {
          ...g,
          rate,
          trendIcon,
          trendColor,
          trendText,
        };
      });
  }, [items]);

  // In memory dynamic listing filter
  const filteredSearchList = useMemo(() => {
    return items.filter((r) => {
      const keywords =
        `${r.title} ${r.desc || r.description || ""} ${r.location}`.toLowerCase();

      // Keyword matching
      if (sQuery.trim() && !keywords.includes(sQuery.toLowerCase())) {
        return false;
      }

      // Category keywords browsing bounds
      if (categoryKeywords) {
        const hasKeywordMatch = categoryKeywords.some((kw) =>
          keywords.includes(kw.toLowerCase()),
        );
        if (!hasKeywordMatch) return false;
      }

      // Status dropdown
      if (sFilter === "lost") {
        if (r.type !== "lost" || r.claimed) return false;
      } else if (sFilter === "found") {
        if (r.type !== "found" || r.claimed) return false;
      } else if (sFilter === "claimed") {
        if (!r.claimed) return false;
      }

      // Advanced filters bounds
      if (
        sLoc.trim() &&
        !(r.location || "").toLowerCase().includes(sLoc.toLowerCase())
      ) {
        return false;
      }

      if (sDate.trim()) {
        const itemDateStr = r.date || "";
        if (!itemDateStr.includes(sDate)) return false;
      }

      return true;
    });
  }, [items, sQuery, sFilter, sLoc, sDate, categoryKeywords]);

  // Compute matches scores for active queries
  const smartMatches = useMemo(() => {
    if (sQuery.trim().length < 3) return [];

    const fake = {
      id: "fake_search",
      title: sQuery,
      desc: "",
      location: "",
      type: "lost",
      createdAt: Date.now(),
      claimed: false,
    };

    return items
      .filter((r) => r.type === "found" && !r.claimed)
      .map((r) => ({ report: r, score: computeMatchScore(fake, r) }))
      .filter((x) => x.score > 0.12)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  }, [items, sQuery]);

  // Complete clean JSX structure wrapping converted index.html tags
  return (
    <div className="relative min-h-screen bg-surface-container">
      {/* ── TOAST MESSAGES FLOATER ── */}
      <div className="toast-container" id="toastContainer">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-msg ${t.type}`}>
            {t.msg}
          </div>
        ))}
      </div>

      {/* ── IMMERSIVE BACKGROUND GRID (Only on landing or auth views) ── */}
      {(currentView === "login" ||
        currentView === "signup" ||
        currentView === "verify-email") && (
        <div className="fixed inset-0 bg-surface-container-low z-0"></div>
      )}

      {/* ── VIEW 1: LANDING PAGE ── */}
      {currentView === "landing" && (
        <div className="bg-surface text-on-surface font-sans antialiased overflow-x-hidden min-h-screen flex flex-col">
          {/* TopNavBar */}
          <header className="w-full top-0 z-50 bg-surface shadow-sm sticky">
            <div className="flex justify-between items-center h-16 px-4 md:px-8 max-w-7xl mx-auto">
              <div className="font-sans text-2xl font-bold text-primary tracking-tight flex items-center gap-2">
                <img src="/logo.png" alt="FindTrack Logo" className="w-10 h-10 object-contain p-1 mx-1" onError={(e) => { e.currentTarget.style.display='none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
                <MapPin className="h-6 w-6 text-primary hidden" />
                FindTrack
              </div>
              <nav className="hidden md:flex items-center gap-6">
                <button onClick={() => setCurrentView("landing")} className="text-primary border-b-2 border-primary pb-1 font-medium text-sm hover:text-primary transition-colors duration-200">{t('sidebar.home')}</button>
                <button onClick={() => setCurrentView("help")} className="text-on-surface-variant font-medium text-sm hover:text-primary transition-colors duration-200">{t('landing.howItWorks')}</button>
                <button onClick={() => setCurrentView("about")} className="text-on-surface-variant font-medium text-sm hover:text-primary transition-colors duration-200">{t('landing.community')}</button>
                <button onClick={() => setCurrentView("safety")} className="text-on-surface-variant font-medium text-sm hover:text-primary transition-colors duration-200">{t('landing.safety')}</button>
              </nav>
              <div className="flex items-center gap-4">
                <button onClick={() => setCurrentView("login")} className="hidden md:block text-on-surface-variant font-medium text-sm hover:text-primary transition-colors duration-200 scale-95 active:scale-90">{t('landing.login')}</button>
                <button onClick={() => setCurrentView("signup")} className="w-full sm:w-auto bg-primary text-white px-6 py-3 rounded-xl font-bold shadow-md hover:bg-primary-dim transition-colors flex items-center justify-center gap-2">{t('landing.getStarted')}</button>
                {/* Mobile Menu Button */}
                <button 
                  className="md:hidden p-2 text-on-surface-variant hover:text-primary"
                  onClick={() => setLandingMenuOpen(!landingMenuOpen)}
                >
                  {landingMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </button>
              </div>
            </div>
          </header>

          {/* Mobile Nav Dropdown */}
          {landingMenuOpen && (
            <div className="md:hidden absolute top-16 left-0 right-0 bg-surface-container-lowest shadow-xl z-50 p-6 flex flex-col gap-4 border-b border-outline-variant/50">
              <button onClick={() => { setCurrentView("landing"); setLandingMenuOpen(false); }} className="text-left font-medium text-on-surface hover:text-primary py-2">{t('sidebar.home')}</button>
              <button onClick={() => { setCurrentView("help"); setLandingMenuOpen(false); }} className="text-left font-medium text-on-surface hover:text-primary py-2">{t('landing.howItWorks')}</button>
              <button onClick={() => { setCurrentView("about"); setLandingMenuOpen(false); }} className="text-left font-medium text-on-surface hover:text-primary py-2">{t('landing.community')}</button>
              <button onClick={() => { setCurrentView("safety"); setLandingMenuOpen(false); }} className="text-left font-medium text-on-surface hover:text-primary py-2">{t('landing.safety')}</button>
              <hr className="border-outline-variant/50 my-2" />
              <button 
                onClick={() => {
                  setLandingMenuOpen(false);
                  setCurrentView("login");
                }}
                className="text-left font-medium text-on-surface hover:text-primary py-2"
              >{t('landing.login')}</button>
              <button 
                onClick={() => {
                  setLandingMenuOpen(false);
                  setCurrentView("signup");
                }}
                className="bg-primary hover:bg-primary-dim text-white px-6 py-3 rounded-xl font-semibold text-center transition-colors shadow-sm mt-2"
              >{t('landing.getStarted')}</button>
            </div>
          )}

          <main className="flex-1">
            {/* Hero Section */}
            <section className="relative min-h-[921px] flex items-center justify-center overflow-hidden bg-surface">
              <div className="absolute inset-0 z-0">
                <img className="w-full h-full object-cover object-center" alt="Hero background" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCDC3YRMFuO-lEwm9bKTIguR-1belAnXoHIgeigQ3q4SUYgObcsSiNUjHnpR_ZfqvyDsqJKY7pe4fPQ9fAxiXPLcUxQOJOcX6tgsnNpBIFjznIY1JDEnT0amN_j0g91NAtN4xOqL_xe6gYYA1U5PBGH18oRD2F1fn_Z1eAqQ2CYzkwKBwB-0d16PaU0F6IfiXoXHmT6Txuseum5Be0PuKe26wtdeMNMjFB0UJczwaKK0iUeWAfbVmcG-yd4WQJ83LfWGXw7GPVkDQ"/>
                <div className="absolute inset-0 bg-surface/30 backdrop-blur-[2px]"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-[#fffbff] via-transparent to-transparent"></div>
              </div>
              <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 text-center mt-8 w-full">
                <div className="bg-surface-container-lowest/85 backdrop-blur-md border border-white/30 p-8 md:p-12 rounded-xl inline-block max-w-3xl shadow-lg w-full">
                  <img src="/logo.png" alt="FindTrack Logo" className="w-40 h-40 object-contain mx-auto mb-6 drop-shadow-md p-3 mt-2" onError={(e) => { e.currentTarget.style.display='none'; }} />
                  <h1 className="font-sans text-4xl md:text-[48px] md:leading-[56px] font-bold text-primary-dim mb-4">
                    Find what's lost.<br/>Restore community trust.
                  </h1>
                  <p className="font-sans text-lg text-on-surface-variant mb-8 max-w-2xl mx-auto">
                    FindTrack helps Filipinos recover lost belongings through trusted community reporting and verified recovery workflows.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <button 
                      onClick={() => setCurrentView("signup")}
                      className="w-full sm:w-auto bg-primary text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md hover:bg-primary-dim transition-colors flex items-center justify-center gap-2"
                    >
                      <PlusCircle className="w-5 h-5" />
                      Start Reporting
                    </button>
                    <button 
                      onClick={handleGuestBrowse}
                      className="w-full sm:w-auto border-2 border-primary text-primary px-6 py-3 rounded-xl font-bold text-sm hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
                    >{t('landing.howItWorks')}</button>
                  </div>
                </div>
              </div>
            </section>

            {/* Value Propositions (Bento Grid) */}
            <section className="py-24 bg-surface">
              <div className="max-w-7xl mx-auto px-4 md:px-8">
                <div className="text-center mb-16">
                  <h2 className="font-sans text-3xl md:text-4xl font-bold text-primary-dim mb-2">Three Pillars of Recovery</h2>
                  <p className="font-sans text-base text-on-surface-variant max-w-xl mx-auto">A seamless workflow designed to bring your items back home.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Pillar 1 */}
                  <div className="bg-surface-container rounded-xl p-6 flex flex-col items-start border border-[#bcbaa2]/30 hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 bg-[#9af4d6] text-[#005d49] rounded-full flex items-center justify-center mb-4">
                      <FileSearch className="w-6 h-6" />
                    </div>
                    <h3 className="font-sans text-xl font-bold text-primary-dim mb-2">Report</h3>
                    <p className="font-sans text-base text-on-surface-variant">Quickly document lost or found items with AI-assisted details for precise matching.</p>
                  </div>
                  {/* Pillar 2 */}
                  <div className="bg-surface-container-low rounded-xl p-6 flex flex-col items-start border border-[#bcbaa2]/30 hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 bg-[#b5eedb] text-[#235b4c] rounded-full flex items-center justify-center mb-4">
                      <MessageSquareHeart className="w-6 h-6" />
                    </div>
                    <h3 className="font-sans text-xl font-bold text-primary-dim mb-2">Connect</h3>
                    <p className="font-sans text-base text-on-surface-variant">Securely message community members when a match is found, protecting your privacy.</p>
                  </div>
                  {/* Pillar 3 */}
                  <div className="bg-surface-container rounded-xl p-6 flex flex-col items-start border border-[#bcbaa2]/30 hover:shadow-md transition-shadow">
                    <div className="w-12 h-12 bg-tertiary-container text-on-tertiary-container rounded-full flex items-center justify-center mb-4">
                      <Handshake className="w-6 h-6" />
                    </div>
                    <h3 className="font-sans text-xl font-bold text-primary-dim mb-2">Recover</h3>
                    <p className="font-sans text-base text-on-surface-variant">Follow verified hand-off protocols to ensure items return home safely and securely.</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Community Section */}
            <section className="py-24 bg-surface-container">
              <div className="max-w-7xl mx-auto px-4 md:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                  <div>
                    <h2 className="font-sans text-3xl md:text-4xl font-bold text-primary-dim mb-4">By the Community,<br/>For the Community.</h2>
                    <p className="font-sans text-lg text-on-surface-variant mb-6">Built on the foundation of Bayanihan, FindTrack empowers everyday Filipinos to look out for one another.</p>
                    <div className="flex gap-6 mb-8">
                      <div>
                        <div className="font-sans text-3xl font-bold text-primary">{new Set(items.map(i => i.userId)).size}</div>
                        <div className="font-sans text-sm font-medium text-on-surface-variant">{t('profile.communityMember')}s</div>
                      </div>
                      <div className="w-px bg-[#bcbaa2]/50"></div>
                      <div>
                        <div className="font-sans text-3xl font-bold text-tertiary-container">{stats.claimed}</div>
                        <div className="font-sans text-sm font-medium text-on-surface-variant">Successful Recoveries</div>
                      </div>
                    </div>
                    {/* Testimonial Card - Community Recovery Story Empty State / CTA */}
                    <div className="bg-surface-container-lowest rounded-xl p-6 border border-[#bcbaa2]/30 shadow-sm relative hover:shadow-md transition-shadow">
                      <Quote className="absolute top-4 right-4 text-primary/10 w-10 h-10" />
                      <p className="font-sans text-sm text-on-surface-variant mb-4 leading-relaxed relative z-10">
                        Have you successfully returned or recovered an item on FindTrack? Be the first to share your recovery story with the community and inspire others!
                      </p>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                          FT
                        </div>
                        <div>
                          <div className="font-sans text-xs text-on-surface font-bold">Share Your Story</div>
                          <div className="font-sans text-[10px] font-medium text-primary hover:underline cursor-pointer">
                            Email support@findtrack.ph
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="relative h-96 lg:h-auto rounded-xl overflow-hidden shadow-lg border border-[#bcbaa2]/20">
                    <img className="w-full h-full object-cover" alt="Community" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBxlGOvC8tUv_qZ8mbCzoTfeO2pcAAWluudEQ74nJYhDiM6dKFkJnXAMN2tK4YBhxIv0KPww3WsGnpb6KywmxGohTQ6i90nv7w2u0RVCecjGnzgkXMAWIJCDNduz3N6uzUJzOO2X6hUbk8TdWW4cPEa870HJ5Ah1QvAKbwvSknJT3Vri6FIhh8Mm_4iOGeknwaECR9sIKas-PM3QZqG2o9wpOSp-eQc4Fnpoc0yWIHqiDg4zXr3mFK3NE8g9xXChlUOf26yIrPeeg"/>
                  </div>
                </div>
              </div>
            </section>
          </main>

          {/* Footer */}
          <footer className="bg-surface-variant border-t border-[#bcbaa2]/30 w-full mt-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-8 px-4 md:px-8 max-w-7xl mx-auto">
              <div>
                <div className="font-sans text-2xl font-bold text-on-surface mb-4 flex items-center gap-2">
                  <img src="/logo.png" alt="FindTrack Logo" className="w-10 h-10 object-contain p-1 mx-1" onError={(e) => { e.currentTarget.style.display='none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
                  <MapPin className="h-6 w-6 text-primary hidden"/>
                  FindTrack
                </div>
                <p className="font-sans text-base text-on-surface-variant max-w-sm mb-4">© 2026 FindTrack Philippines. Empowering communities through trust and recovery.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <nav className="flex flex-col gap-3">
                  <a onClick={() => { setCurrentView("about"); window.history.pushState(null, "", "/about"); }} className="font-sans text-sm font-medium text-on-surface-variant hover:text-primary hover:underline transition-all opacity-80 hover:opacity-100 cursor-pointer">{t('landing.aboutUs')}</a>
                  <a onClick={() => { setCurrentView("privacy"); window.history.pushState(null, "", "/privacy"); }} className="font-sans text-sm font-medium text-on-surface-variant hover:text-primary hover:underline transition-all opacity-80 hover:opacity-100 cursor-pointer">{t('landing.privacyPolicy')}</a>
                  <a onClick={() => { setCurrentView("terms"); window.history.pushState(null, "", "/terms"); }} className="font-sans text-sm font-medium text-on-surface-variant hover:text-primary hover:underline transition-all opacity-80 hover:opacity-100 cursor-pointer">{t('landing.termsOfService')}</a>
                </nav>
                <nav className="flex flex-col gap-3">
                  <a onClick={() => { setCurrentView("safety"); window.history.pushState(null, "", "/safety"); }} className="font-sans text-sm font-medium text-on-surface-variant hover:text-primary hover:underline transition-all opacity-80 hover:opacity-100 cursor-pointer">{t('landing.safetyGuidelines')}</a>
                  <a onClick={() => { setCurrentView("help"); window.history.pushState(null, "", "/help"); }} className="font-sans text-sm font-medium text-on-surface-variant hover:text-primary hover:underline transition-all opacity-80 hover:opacity-100 cursor-pointer">{t('landing.helpCenter')}</a>
                  <a onClick={() => { setCurrentView("contact"); window.history.pushState(null, "", "/contact"); }} className="font-sans text-sm font-medium text-on-surface-variant hover:text-primary hover:underline transition-all opacity-80 hover:opacity-100 cursor-pointer">{t('landing.contactUs')}</a>
                </nav>
              </div>
            </div>
          </footer>
        </div>
      )}
      {/* ── VIEW 2: LOGIN PAGE ── */}
      {currentView === "login" && (
        <div className="min-h-screen flex items-center justify-center p-4 md:p-8 font-body-md text-on-surface relative z-10">
          {/* Decorative Background Elements */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary-container rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
            <div className="absolute top-40 -left-20 w-72 h-72 bg-secondary-container rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" style={{animationDelay: '2s'}}></div>
            <div className="absolute -bottom-40 left-20 w-80 h-80 bg-tertiary-container rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{animationDelay: '4s'}}></div>
          </div>

          {/* Login Card */}
          <main className="bg-surface-container-lowest border border-outline-variant/30 shadow-[0_8px_32px_0_rgba(1,114,90,0.05)] w-full max-w-96 rounded-xl p-8 relative z-10">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="font-headline-lg text-4xl text-primary mb-3 cursor-pointer" onClick={() => setCurrentView("landing")}>FindTrack</h1>
              <p className="font-body-lg text-lg text-on-surface-variant">Welcome back to the community.</p>
            </div>

            {/* Form */}
            <form onSubmit={handleLoginSubmit} name="login" className="space-y-6">
              {/* Email Field */}
              <div>
                <label className="block font-label-md text-sm text-on-surface mb-1" htmlFor="email">{t('profile.emailAddress')}</label>
                <div className="relative">
                  <input 
                    className="shadow-sm w-full pr-10 pl-3 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl font-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors" 
                    id="email" 
                    name="email" 
                    placeholder="you@example.com" 
                    required 
                    type="email"
                    autoComplete="email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                  />
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant h-5 w-5" strokeWidth={1.5} />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label className="block font-label-md text-sm text-on-surface mb-1" htmlFor="password">Password</label>
                <div className="relative">
                  <input 
                    className="shadow-sm w-full pl-3 pr-16 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl font-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors" 
                    id="password" 
                    name="password" 
                    placeholder="••••••••" 
                    required 
                    type={showPass ? "text" : "password"}
                    autoComplete="current-password"
                    value={authPassword}
                    onChange={(e) => setAuthPass(e.target.value)}
                  />
                  <Lock className="absolute right-10 top-1/2 -translate-y-1/2 text-on-surface-variant h-5 w-5 pointer-events-none" strokeWidth={1.5} />
                  <button 
                    type="button" 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors focus:outline-none" 
                    onClick={() => setShowPass(!showPass)}
                  >
                    {showPass ? (
                      <EyeOff className="h-5 w-5" strokeWidth={1.5} />
                    ) : (
                      <Eye className="h-5 w-5" strokeWidth={1.5} />
                    )}
                  </button>
                </div>
                <div className="flex justify-end mt-2">
                  <button 
                    type="button"
                    onClick={() => setCurrentView("reset")}
                    className="font-label-md text-sm text-primary hover:text-primary-dim transition-colors" 
                  >
                    Forgot Password?
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button 
                className="w-full py-3 px-4 bg-primary text-on-primary rounded-xl font-body-lg text-lg font-medium hover:bg-primary-dim transition-colors shadow-sm flex items-center justify-center gap-3" 
                type="submit"
              >{t('landing.login')}</button>
            </form>

            {/* Footer */}
            <div className="mt-8 text-center">
              <p className="font-body-md text-on-surface-variant">
                Don't have an account?{" "}
                <button 
                  onClick={() => setCurrentView("signup")}
                  className="text-primary font-semibold hover:underline transition-all"
                >
                  Sign up
                </button>
              </p>
            </div>
          </main>
        </div>
      )}

      {/* ── VIEW 3: SIGNUP PAGE ── */}
      {currentView === "signup" && (
        <div className="min-h-screen flex items-center justify-center p-4 md:p-8 font-body-md text-on-surface relative z-10">
          {/* Decorative Background Elements */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
            <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary-container rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
            <div className="absolute top-40 -left-20 w-72 h-72 bg-secondary-container rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" style={{animationDelay: '2s'}}></div>
            <div className="absolute -bottom-40 left-20 w-80 h-80 bg-tertiary-container rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{animationDelay: '4s'}}></div>
          </div>

          {/* Signup Card */}
          <main className="bg-surface-container-lowest border border-outline-variant/30 shadow-[0_8px_32px_0_rgba(1,114,90,0.05)] w-full max-w-96 rounded-xl p-8 relative z-10">
            {/* Header */}
            <div className="text-center mb-6">
              <h1 className="font-headline-lg text-4xl text-primary mb-3 cursor-pointer" onClick={() => setCurrentView("landing")}>FindTrack</h1>
              <h2 className="font-headline-md text-2xl font-bold text-on-surface">Create an account</h2>
              <p className="font-body-md text-sm text-on-surface-variant mt-1">
                Already a member?{" "}
                <button 
                  onClick={() => setCurrentView("login")}
                  className="font-semibold text-primary hover:underline transition-colors"
                >
                  Login here
                </button>
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSignupSubmit} name="signup" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-label-md text-xs text-on-surface mb-1" htmlFor="firstName">First Name</label>
                  <input 
                    id="firstName" 
                    name="firstName" 
                    type="text" 
                    required 
                    autoComplete="given-name"
                    value={signupFirst}
                    onChange={(e) => setSignupFirst(e.target.value)}
                    className="block w-full rounded-xl border border-outline-variant/60 py-3 px-4 bg-surface-container-low shadow-sm placeholder:text-outline focus:border-primary focus:ring-1 focus:ring-primary outline-none font-body-md transition-shadow text-sm"
                  />
                </div>
                <div>
                  <label className="block font-label-md text-xs text-on-surface mb-1" htmlFor="lastName">Last Name</label>
                  <input 
                    id="lastName" 
                    name="lastName" 
                    type="text" 
                    required 
                    autoComplete="family-name"
                    value={signupLast}
                    onChange={(e) => setSignupLast(e.target.value)}
                    className="block w-full rounded-xl border border-outline-variant/60 py-3 px-4 bg-surface-container-low shadow-sm placeholder:text-outline focus:border-primary focus:ring-1 focus:ring-primary outline-none font-body-md transition-shadow text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block font-label-md text-xs text-on-surface mb-1" htmlFor="signup-email-field">Email address</label>
                <input 
                  id="signup-email-field" 
                  name="email" 
                  type="email" 
                  required 
                  autoComplete="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="block w-full rounded-xl border border-outline-variant/60 py-3 px-4 bg-surface-container-low shadow-sm placeholder:text-outline focus:border-primary focus:ring-1 focus:ring-primary outline-none font-body-md transition-shadow text-sm"
                />
              </div>

              <div>
                <label className="block font-label-md text-xs text-on-surface mb-1" htmlFor="phone">{t('profile.phoneNumber')} (Optional)</label>
                <input 
                  id="phone" 
                  name="phone" 
                  type="tel" 
                  value={signupContact}
                  onChange={(e) => setSignupContact(e.target.value)}
                  className="block w-full rounded-xl border border-outline-variant/60 py-3 px-4 bg-surface-container-low shadow-sm placeholder:text-outline focus:border-primary focus:ring-1 focus:ring-primary outline-none font-body-md transition-shadow text-sm"
                />
              </div>

              <div>
                <label className="block font-label-md text-xs text-on-surface mb-1" htmlFor="signup-password-field">Password</label>
                <div className="relative">
                  <input 
                    id="signup-password-field" 
                    name="password" 
                    type={showPass ? "text" : "password"}
                    required 
                    autoComplete="new-password"
                    value={authPassword}
                    onChange={(e) => setAuthPass(e.target.value)}
                    className="block w-full rounded-xl border border-outline-variant/60 py-3 px-4 bg-surface-container-low shadow-sm placeholder:text-outline focus:border-primary focus:ring-1 focus:ring-primary outline-none font-body-md transition-shadow text-sm pr-10"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors focus:outline-none" 
                  >
                    {showPass ? (
                      <EyeOff className="h-5 w-5" strokeWidth={1.5} />
                    ) : (
                      <Eye className="h-5 w-5" strokeWidth={1.5} />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center">
                <input 
                  id="terms" 
                  name="terms" 
                  type="checkbox" 
                  required 
                  className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary bg-surface-container-low"
                />
                <label className="ml-3 block font-body-md text-xs text-on-surface-variant" htmlFor="terms">
                  I agree to the <button type="button" onClick={() => setCurrentView("terms")} className="text-primary hover:underline">{t('landing.termsOfService')}</button> and <button type="button" onClick={() => setCurrentView("privacy")} className="text-primary hover:underline">{t('landing.privacyPolicy')}</button>.
                </label>
              </div>

              <div>
                <button 
                  type="submit" 
                  disabled={loadingAuth}
                  className="flex w-full justify-center rounded-xl bg-primary px-4 py-3 font-label-md text-sm font-semibold text-on-primary shadow-sm hover:bg-primary-dim focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors disabled:opacity-70 mt-2"
                >
                  {loadingAuth ? "Creating Account..." : "Create Account"}
                </button>
              </div>
            </form>
          </main>
        </div>
      )}

      {/* ── VIEW 5: VERIFY EMAIL SCREEN ── */}
      {currentView === "verify-email" && (
        <div className="min-h-screen flex flex-col bg-surface-container text-on-surface">
          {/* Header */}
          <header className="w-full bg-surface shadow-sm border-b border-outline-variant/20 py-4 px-6 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>eco</span>
              <span className="font-headline-md text-lg font-bold text-primary tracking-tight">FindTrack</span>
            </div>
            <button 
              onClick={() => triggerToast("If the verification link is expired, request a new verification email.", "error")}
              className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined">help</span>
            </button>
          </header>

          {/* Main Content */}
          <div className="flex-grow flex items-center justify-center p-4">
            <div className="bg-surface w-full max-w-md rounded-xl shadow-[0_8px_32px_rgba(1,114,90,0.06)] p-8 md:p-10 flex flex-col items-center text-center border border-outline-variant/30 animate-[fadeInUp_0.8s_ease_forwards]">
              {/* Icon */}
              <div className="w-16 h-16 bg-primary-container rounded-full flex items-center justify-center mb-6 shadow-sm">
                <span className="material-symbols-outlined text-3xl text-on-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>mark_email_read</span>
              </div>

              {/* Heading */}
              <h1 className="font-sans text-2xl font-bold text-on-surface mb-3">Verify Your Email</h1>
              <p className="font-body-lg text-sm text-on-surface-variant mb-6 px-2 leading-relaxed">
                We've sent a verification link to{" "}
                <strong className="text-on-surface font-semibold">
                  {auth.currentUser?.email || profileEmail || "your email address"}
                </strong>
                . Please click the link to activate your account.
              </p>

              {/* Helper Box */}
              <div className="w-full mb-8">
                <p className="font-body-md text-xs text-on-surface-variant bg-surface-container-low p-4 rounded-xl border border-outline-variant/40 leading-relaxed text-left">
                  Check your inbox and click the link to verify your account. Once verified, click below to continue.
                </p>
              </div>

              {/* Buttons */}
              <div className="w-full space-y-4">
                <button
                  onClick={async () => {
                    try {
                      if (auth.currentUser) {
                        await auth.currentUser.reload();
                        if (auth.currentUser.emailVerified) {
                          await auth.currentUser.getIdToken(true);
                          triggerToast(
                            "✅ Verification successful! Welcome to FindTrack.",
                            "success",
                          );
                          setCurrentView("verification-success");
                        } else {
                          triggerToast(
                            "ℹ️ Email is not verified yet. Please check your inbox.",
                            "error",
                          );
                        }
                      } else {
                        triggerToast(
                          "❌ Session lost. Please log in again.",
                          "error",
                        );
                        setCurrentView("login");
                      }
                    } catch (e: any) {
                      console.error(e);
                      triggerToast(
                        "❌ " + (e.message || "Failed to check status."),
                        "error",
                      );
                    }
                  }}
                  className="w-full bg-primary hover:bg-primary-dim text-white font-semibold py-3.5 px-4 rounded-xl shadow-sm hover:shadow transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  Check Verification Status
                  <ArrowRight className="h-4 w-4" />
                </button>

                <button
                  onClick={async () => {
                    if (resendCooldown > 0) return;
                    try {
                      if (auth.currentUser) {
                        const actionCodeSettings = {
                          url: window.location.origin,
                          handleCodeInApp: false,
                        };
                        await sendEmailVerification(
                          auth.currentUser,
                          actionCodeSettings,
                        );
                        triggerToast("✅ Verification email resent!", "success");
                        setResendCooldown(30);
                      } else {
                        triggerToast(
                          "❌ Session lost. Please log in again.",
                          "error",
                        );
                        setCurrentView("login");
                      }
                    } catch (e: any) {
                      console.error("Resend error:", e);
                      if (e.message?.includes("too-many-requests")) {
                        triggerToast(
                          "❌ Too many requests. Please wait a minute and try again.",
                          "error",
                        );
                        setResendCooldown(60);
                      } else {
                        triggerToast(
                          "❌ Failed to resend. Please try again later.",
                          "error",
                        );
                      }
                    }
                  }}
                  disabled={resendCooldown > 0}
                  className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-200 border flex items-center justify-center gap-2 cursor-pointer ${
                    resendCooldown > 0
                      ? "bg-surface-container-low text-on-surface-variant/40 border-outline-variant/30 cursor-not-allowed"
                      : "text-primary hover:bg-primary/5 border-primary"
                  }`}
                >
                  {resendCooldown > 0
                    ? `Resend Available in ${resendCooldown}s`
                    : "Resend Verification Email"}
                </button>
              </div>

              {/* Back to Login */}
              <div className="mt-8 flex justify-center w-full">
                <button
                  onClick={async () => {
                    await handleLogoutAction();
                    setCurrentView("login");
                  }}
                  className="text-on-surface-variant hover:text-primary font-body-md text-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to login
                </button>
              </div>

              {/* Expired link help */}
              <div className="mt-6 pt-4 border-t border-outline-variant/20 w-full">
                <button
                  type="button"
                  onClick={() => triggerToast("If the verification link is expired, request a new verification email.", "error")}
                  className="w-full flex items-center justify-center gap-2 p-3 bg-tertiary-container/10 hover:bg-tertiary-container/20 border border-tertiary-container/50 text-on-tertiary-container rounded-xl text-xs transition-colors font-medium shadow-sm"
                >
                  <span className="text-sm">❓</span>
                  <span>Link says "Expired or already used"? Click here!</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── VIEW 5.5: VERIFICATION SUCCESS SCREEN ── */}
      {currentView === "verification-success" && (
        <div className="min-h-screen bg-surface-container text-on-surface flex items-center justify-center relative overflow-hidden font-body-lg p-4">
          <style>{`
            @keyframes fall {
              0% {
                transform: translateY(-100vh) rotate(0deg);
                opacity: 1;
              }
              100% {
                transform: translateY(100vh) rotate(360deg);
                opacity: 0;
              }
            }
          `}</style>
          
          {/* Confetti pieces */}
          <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
            {confetti.map((piece) => (
              <div
                key={piece.id}
                className="absolute w-2.5 h-5 rounded-sm"
                style={{
                  backgroundColor: piece.color,
                  left: piece.left,
                  animationName: "fall",
                  animationDuration: piece.duration,
                  animationDelay: piece.delay,
                  animationTimingFunction: "linear",
                  animationIterationCount: "infinite",
                  opacity: 0.85,
                }}
              />
            ))}
          </div>

          <div className="w-full max-w-md px-4 z-20">
            <div className="bg-surface rounded-xl shadow-xl p-8 md:p-10 text-center flex flex-col items-center border border-surface-variant/50 animate-[fadeInUp_0.8s_ease_forwards]">
              {/* Success Icon */}
              <div className="w-20 h-20 rounded-full bg-primary-container flex items-center justify-center mb-6 shadow-sm relative">
                <div className="absolute inset-0 rounded-full bg-primary-container animate-ping opacity-25"></div>
                <CheckCircle2 className="h-10 w-10 text-primary" strokeWidth={2.5} />
              </div>

              {/* Typography */}
              <h1 className="font-sans text-2xl font-bold text-on-surface mb-3 animate-[scaleIn_0.6s_ease_forwards]">
                Verification Successful!
              </h1>
              <p className="font-body-md text-sm text-on-surface-variant mb-8 px-4 leading-relaxed">
                Your account is now active. You can now start reporting lost items or searching for your belongings.
              </p>

              {/* Action Button */}
              <button
                onClick={() => {
                  setCurrentView("dashboard");
                }}
                className="w-full bg-primary hover:bg-primary-dim text-white font-semibold py-3.5 px-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                Go to Dashboard
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>

            {/* Brand Footer */}
            <div className="mt-6 text-center opacity-75">
              <p className="font-sans font-extrabold text-primary tracking-wider text-sm flex items-center justify-center gap-1.5">
                <span className="material-symbols-outlined text-sm">eco</span> FindTrack
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Static info & legal pages ── */}
      {currentView === "privacy" && <PrivacyPage onBack={handleBackToSafety} />}
      {currentView === "terms" && <TermsPage onBack={handleBackToSafety} />}
      {currentView === "about" && <AboutPage onHome={goToLanding} />}
      {currentView === "safety" && <SafetyPage onHome={goToLanding} />}
      {currentView === "help" && <HelpPage onHome={goToLanding} />}
      {currentView === "contact" && <ContactPage onHome={goToLanding} />}

      {/* ── VIEW 4: MAIN DASHBOARD PORTAL ── */}
      {currentView === "dashboard" && (
        <div className="flex h-[100dvh] bg-surface-container-lowest text-on-surface font-body-md overflow-hidden">
          {/* Mobile Sidebar Overlay */}
          {sidebarOpen && (
            <div 
              className="fixed inset-0 bg-black/50 z-40 md:hidden" 
              onClick={() => setSidebarOpen(false)}
            />
          )}
          {/* SIDEBAR (Desktop) */}
          <aside className={`fixed md:relative z-50 flex flex-col w-64 h-full bg-[#00725a] text-white shadow-md transition-transform transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}>
            {/* Brand Header */}
            <div className="pt-8 pb-8 px-8 shrink-0">
              <div className="flex justify-between items-start">
                <div className="flex flex-col gap-4">
                  <img src="/logo.png" alt="FindTrack Logo" className="w-20 h-20 object-contain bg-surface-container-lowest rounded-xl p-3 shadow-sm my-2" onError={(e) => { e.currentTarget.style.display='none'; }} />
                  <div className="mt-1">
                    <h1 className="text-3xl font-bold tracking-tight text-white font-poppins leading-none">
                      FindTrack
                    </h1>
                    <p className="text-[11px] font-medium tracking-wider text-white/75 mt-3 uppercase font-dmsans">Community Lost & Found</p>
                  </div>
                </div>
                <button 
                  className="md:hidden text-white/70 hover:text-white p-1 rounded-xl bg-surface-container-lowest/10" 
                  onClick={() => setSidebarOpen(false)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Navigation Items */}
            <nav className="flex-1 overflow-y-auto space-y-1.5 px-4 py-4">
              {[
                { id: "home", label: t('sidebar.home'), icon: HomeIcon },
                { id: "report", label: t('sidebar.reportItem'), icon: PlusCircle },
                { id: "search", label: t('sidebar.search'), icon: Search },
                { id: "notifications", label: t('sidebar.alerts'), icon: Bell },
                { id: "profile", label: t('sidebar.profile'), icon: UserIcon },
                { id: "myitems", label: t('sidebar.myItems'), icon: Archive },
                { id: "pinned", label: t('sidebar.pinnedItems'), icon: Pin },
                { id: "categories", label: t('sidebar.categories'), icon: Shapes },
                { id: "analytics", label: t('sidebar.analytics'), icon: BarChart2 },
                { id: "tips", label: t('sidebar.recoveryTips'), icon: HeartHandshake },
                { id: "packaging", label: t('sidebar.packagingTips'), icon: Package },
                { id: "settings", label: t('sidebar.settings'), icon: Settings },
                { id: "about", label: t('sidebar.aboutHelp'), icon: HelpCircle }
              ].map((item) => {
                const isSelected = activeTab === item.id || (activeTab === "itemDetail" && item.id === "search") || (activeTab === "claimItem" && item.id === "search");
                
                if (item.id === "about") {
                  return (
                    <div key={item.id} className="pt-2 pb-2">
                      <button
                        onClick={() => {
                          setActiveTab("about");
                          setSidebarOpen(false);
                        }}
                        className={`w-full flex items-center px-4 min-h-12 rounded-xl transition-all duration-200 text-left gap-4 ${
                          isSelected
                            ? "bg-primary-container text-[#005d49] font-semibold shadow-sm"
                            : "text-white/80 hover:text-white hover:bg-surface-container-lowest/10"
                        }`}
                      >
                        <item.icon className={`h-5 w-5 shrink-0 ${isSelected ? "text-[#005d49]" : "opacity-80"}`} />
                        <span className="text-[15px] font-medium tracking-wide font-dmsans whitespace-nowrap truncate">{item.label}</span>
                      </button>
                    </div>
                  );
                }

                return (
                  <button
                    key={item.label}
                    onClick={() => {
                      if (profileName === "Guest" && ["report", "analytics", "profile", "myitems", "pinned"].includes(item.id)) {
                        setShowGuestModal(true);
                      } else {
                        setActiveTab(item.id);
                        if (item.id === "home" || item.id === "search") setCategoryKeywords(null);
                      }
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center px-4 min-h-12 rounded-xl transition-all duration-200 text-left gap-4 ${
                      isSelected
                        ? "bg-primary-container text-[#005d49] font-semibold shadow-sm" 
                        : "text-white/80 hover:text-white hover:bg-surface-container-lowest/10"
                    }`}
                  >
                    <item.icon className={`h-5 w-5 shrink-0 ${isSelected ? "text-[#005d49]" : "opacity-80"}`} />
                    <span className="text-[15px] font-medium tracking-wide font-dmsans whitespace-nowrap truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Footer Items */}
            <div className="p-4 px-6 border-t border-white/10 shrink-0 mt-auto hidden md:block">
              {profileName === "Guest" ? (
                <button 
                  onClick={() => handleGuestBrowse()}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 text-white/80 hover:text-white hover:bg-surface-container-lowest/10 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <LogOut className="h-5 w-5 opacity-80" />
                    <span className="font-medium font-dmsans text-[15px]">Login / Sign Up</span>
                  </div>
                </button>
              ) : (
                <div className="flex items-center justify-between gap-3 px-3 py-3 rounded-xl bg-surface-container-lowest/5 border border-white/10">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-primary-container text-[#005d49] flex items-center justify-center font-bold text-sm shrink-0 uppercase">
                      {profileName.charAt(0)}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold text-white truncate w-24 font-poppins">{profileName}</span>
                      <span className="text-[10px] text-white/60 truncate w-28 font-dmsans">{auth.currentUser?.email || "User"}</span>
                    </div>
                  </div>
                  <button 
                    onClick={handleLogoutAction}
                    className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-surface-container-lowest/10 transition-colors shrink-0"
                    title="Logout"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>
</aside>

          {/* MAIN CONTENT AREA */}
          <div className="flex-1 flex flex-col min-w-0 h-full">
            {/* TOP BAR */}
            <header className="h-16 shrink-0 flex items-center justify-between px-6 bg-surface-container-lowest border-b border-outline-variant z-40">
              <div className="flex items-center gap-4">
                <button 
                  className="md:hidden text-on-surface"
                  onClick={() => setSidebarOpen(true)}
                >
                  <Menu className="h-5 w-5" />
                </button>
                <div className="md:hidden flex items-center gap-2">
                  <img src="/logo.png" alt="FindTrack Logo" className="w-10 h-10 object-contain p-1 mx-1" onError={(e) => { e.currentTarget.style.display='none'; }} />
                  <span className="font-bold text-primary tracking-tight text-lg">FindTrack</span>
                </div>
                <div className="relative hidden sm:block" onClick={() => setActiveTab('search')}>
                  <input 
                    type="text" 
                    placeholder="Search community..."
                    className="pr-10 pl-4 py-2 bg-surface-container rounded-full text-sm border-none focus:ring-2 focus:ring-primary outline-none w-64 pointer-events-none"
                    readOnly
                  />
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-outline" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => {
                    if (profileName === "Guest") setShowGuestModal(true);
                    else setActiveTab("report");
                  }}
                  className="hidden sm:flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-full text-sm font-medium hover:bg-primary-dim transition-colors"
                >
                  <PlusCircle className="h-4 w-4" />
                  Report Item
                </button>
                <button 
                  onClick={() => setActiveTab('notifications')}
                  className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors relative"
                >
                  <Bell className="h-6 w-6" />
                  {activeIncomingClaims.filter(c => !c.isReadByFinder).length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full"></span>}
                </button>
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold cursor-pointer">
                  {profileName === "Guest" ? "G" : profileName.charAt(0).toUpperCase()}
                </div>
              </div>
            </header>

            {/* MAIN PANELS INJECTION DESK */}

          <main className="flex-1 overflow-y-auto bg-surface-container-low p-4 pb-28 md:p-6 lg:p-8 relative">
            {/* PANEL: HOME */}
            <section
              id="home"
              className={`${activeTab === "home" ? "flex" : "hidden"} max-w-5xl mx-auto h-full flex-col`}
            >
              <Home
                items={items}
                stats={stats}
                profileName={profileName}
                setActiveTab={setActiveTab}
                setCategoryKeywords={setCategoryKeywords}
                setShowGuestModal={setShowGuestModal}
              />
            </section>
            {/* PANEL: REPORT SUBMISSION */}
            <section
              id="report"
              className={`${activeTab === "report" ? "block" : "hidden"}`}
            >
              <div className="max-w-3xl mx-auto space-y-8">
                <header className="mb-8">
                  <h2 className="font-headline-lg text-3xl font-bold text-on-surface">{t('dashboard.reportAnItem')}</h2>
                  <p className="font-body-md text-on-surface-variant mt-2">{t('dashboard.fillInTheDetailsBelowOurSmartMatchingSystemWillHelpFindTheOwnerOrTheItem')}</p>
                </header>

                <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
                  {/* Stepper Header */}
                  <div className="flex border-b border-outline-variant bg-surface-variant/50">
                    <div className={`flex-1 py-4 px-6 text-center text-sm font-bold border-b-2 ${reportStep >= 1 ? 'border-primary text-primary' : 'border-transparent text-outline'}`}>
                      {t('dashboard.1BasicInfo')}
                    </div>
                    <div className={`flex-1 py-4 px-6 text-center text-sm font-bold border-b-2 ${reportStep >= 2 ? 'border-primary text-primary' : 'border-transparent text-outline'}`}>
                      {t('dashboard.2Details')}
                    </div>
                    <div className={`flex-1 py-4 px-6 text-center text-sm font-bold border-b-2 ${reportStep >= 3 ? 'border-primary text-primary' : 'border-transparent text-outline'}`}>
                      {t('dashboard.3Verification')}
                    </div>
                  </div>

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      
                      // Custom Step Validation with Toast Messages (fixes silent blocks inside iframes)
                      if (reportStep === 1) {
                        if (!reportTitle.trim()) {
                          triggerToast("❌ Item title is required.", "error");
                          return;
                        }
                        if (!reportLocation.trim()) {
                          triggerToast(reportType === "lost" ? "❌ Location lost is required." : "❌ Location found is required.", "error");
                          return;
                        }
                        setReportStep(2);
                        return;
                      }
                      
                      if (reportStep === 2) {
                        if (!reportDesc.trim()) {
                          triggerToast("❌ Detailed description is required.", "error");
                          return;
                        }
                        setReportStep(3);
                        return;
                      }
                      
                      if (reportStep === 3) {
                        if (!reportSecurityQuestion.trim()) {
                          triggerToast("❌ Verification question is required.", "error");
                          return;
                        }
                        await handleReportSubmit(e);
                        setReportStep(1);
                        return;
                      }
                    }}
                    className="p-6 md:p-8 space-y-6"
                  >
                    {/* STEP 1: Basic Info */}
                    {reportStep === 1 && (
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <label className="block font-label-md font-bold text-on-surface">{t('report.iAmReportingA')}</label>
                        <div className="grid grid-cols-2 gap-4">
                          <label className={`cursor-pointer border rounded-xl p-4 flex flex-col items-center gap-2 transition-all ${reportType === "lost" ? "border-error text-error bg-error/5 ring-2 ring-error/20" : "border-outline-variant text-on-surface-variant hover:bg-surface-variant"}`}>
                            <input type="radio" name="reportType" value="lost" checked={reportType === "lost"} onChange={() => setReportType("lost")} className="sr-only" />
                            <Search className="h-6 w-6" />
                            <span className="font-bold">{t('report.lostItem')}</span>
                          </label>
                          <label className={`cursor-pointer border rounded-xl p-4 flex flex-col items-center gap-2 transition-all ${reportType === "found" ? "border-primary text-primary bg-primary/5 ring-2 ring-primary/20" : "border-outline-variant text-on-surface-variant hover:bg-surface-variant"}`}>
                            <input type="radio" name="reportType" value="found" checked={reportType === "found"} onChange={() => setReportType("found")} className="sr-only" />
                            <PackageCheck className="h-6 w-6" />
                            <span className="font-bold">{t('report.foundItem')}</span>
                          </label>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="block font-label-md font-bold text-on-surface">{t('report.itemTitle')}</label>
                        <input type="text" value={reportTitle} onChange={(e) => setReportTitle(e.target.value)} placeholder={t('report.itemTitlePlaceholder')} className="w-full bg-surface-variant border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="block font-label-md font-bold text-on-surface">{reportType === "lost" ? t('report.locationLost') : t('report.locationFound')}</label>
                        <div className="relative">
                          <input type="text" value={reportLocation} onChange={(e) => setReportLocation(e.target.value)} placeholder={t('report.locationPlaceholder')} className="w-full bg-surface-variant border-none rounded-xl pr-12 pl-4 py-3 focus:ring-2 focus:ring-primary outline-none" />
                          <MapPin className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-outline pointer-events-none" />
                        </div>
                      </div>
                    </div>
                    )}
                    {/* STEP 2: Details */}
                    {reportStep === 2 && (
                    <div className="space-y-6">
                      <ReportDetailsStep 
                        reportType={reportType}
                        reportCategory={reportCategory}
                        setReportCategory={setReportCategory}
                        reportDesc={reportDesc}
                        setReportDesc={setReportDesc}
                        reportColor={reportColor}
                        setReportColor={setReportColor}
                        reportDate={reportDate}
                        setReportDate={setReportDate}
                        reportImage={reportImage}
                        setReportImage={setReportImage}
                        setReportImageFile={setReportImageFile}
                      />
                    </div>
                    )}
                    {/* STEP 3: Verification */}
                    {reportStep === 3 && (
                    <div className="space-y-6">
                      <ReportVerificationStep 
                        reportSecurityQuestion={reportSecurityQuestion}
                        setReportSecurityQuestion={setReportSecurityQuestion}
                        reportTitle={reportTitle}
                        reportType={reportType}
                        reportCategory={reportCategory}
                      />
                    </div>
                    )}

                    {/* Footer Actions */}
                    <div className="pt-6 border-t border-outline-variant flex justify-between items-center mt-8">
                      {reportStep > 1 ? (
                        <button type="button" onClick={() => setReportStep(reportStep - 1)} className="px-6 py-2.5 rounded-full font-label-md font-bold text-on-surface border border-outline-variant hover:bg-surface-variant transition-colors">
                          {t('report.back')}
                        </button>
                      ) : <div></div>}
                      
                      <button type="submit" disabled={isUploading} className="px-6 py-2.5 rounded-full font-label-md font-bold bg-primary text-on-primary hover:bg-primary-dim transition-colors flex items-center gap-2 shadow-sm disabled:opacity-70">
                        {isUploading ? t('report.uploading') : reportStep < 3 ? t('report.continue') : (
                          <><Send className="h-4 w-4" /> {t('report.submitReport')}</>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </section>

            {/* PANEL: SEARCH REGISTRY */}
            <section
              id="search"
              className={`${activeTab === "search" ? "block" : "hidden"} `}
            >
              <div className="p-4 md:p-8">
                {/* Search Header & Filters (Bento Layout) */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 mb-8">
                  {/* Large Search Hero */}
                  <div className="md:col-span-8 bg-surface-container-high rounded-xl p-6 md:p-8 relative overflow-hidden group">
                    <div className="absolute inset-0 opacity-10 bg-cover bg-center"></div>
                    <div className="relative z-10">
                      <h2 className="font-headline-lg text-3xl font-bold text-primary mb-2">{t('search.findLostItems')}</h2>
                      <p className="font-body-lg text-on-surface-variant mb-6">{t('search.searchThroughOurCommunityDatabaseToFindWhatYoureLookingFor')}</p>
                      <div className="relative flex items-center w-full shadow-sm rounded-xl overflow-hidden border border-outline-variant focus-within:border-primary transition-colors bg-surface">
                        <div className="pl-4 text-on-surface-variant">
                          <Search className="h-6 w-6" />
                        </div>
                        <input 
                          className="w-full px-4 py-4 bg-transparent border-none focus:ring-0 font-body-lg text-on-surface placeholder:text-on-surface-variant/50 outline-none" 
                          placeholder={t("search.searchByKeywordsBrandsOrDescriptions")} 
                          type="text"
                          value={sQuery}
                          onChange={(e) => setSQuery(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Quick Filters */}
                  <div className="md:col-span-4 flex flex-col gap-4">
                    <div className="bg-surface-container rounded-xl p-4 flex-1 border border-outline-variant/30 flex flex-col justify-center hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-label-md text-xs text-on-surface-variant uppercase tracking-wider mb-1">{t('search.status')}</h3>
                          <select 
                            value={sFilter}
                            onChange={(e) => setSFilter(e.target.value)}
                            className="bg-transparent border-none p-0 font-headline-md text-lg text-primary focus:ring-0 cursor-pointer outline-none font-bold"
                          >
                            <option value="all">{t('search.allItems')}</option>
                            <option value="lost">{t('search.lostOnly')}</option>
                            <option value="found">{t('search.foundOnly')}</option>
                            <option value="claimed">{t('search.resolved')}</option>
                          </select>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
                          <Filter className="h-5 w-5" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-tertiary-container/20 rounded-xl p-4 flex-1 border border-tertiary-container/30 flex flex-col justify-center hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <div className="w-full pr-2">
                          <h3 className="font-label-md text-xs text-tertiary uppercase tracking-wider mb-1">{t('search.location')}</h3>
                          <input 
                            value={sLoc}
                            onChange={(e) => setSLoc(e.target.value)}
                            placeholder={t("search.typeLocation")}
                            className="bg-transparent border-none p-0 w-full font-headline-md text-lg text-on-surface leading-tight focus:ring-0 outline-none placeholder:text-on-surface/50 font-bold"
                          />
                        </div>
                        <div className="w-10 h-10 shrink-0 rounded-full bg-tertiary-container text-on-tertiary-container flex items-center justify-center">
                          <MapPin className="h-5 w-5" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dynamic Categories highlight info bar */}
                {categoryKeywords && (
                  <div className="mb-8 bg-primary-container/30 border border-primary-container/50 text-on-primary-container py-3 px-4 rounded-xl flex items-center justify-between">
                    <span className="font-body-md">{t('search.filteredByCategory')}<strong className="capitalize">{categoryKeywords[0]}</strong></span>
                    <button
                      onClick={() => setCategoryKeywords(null)}
                      className="font-label-md text-sm font-bold text-primary hover:text-primary-dim underline"
                    >
                      {t('search.clearCategoryFilter')}
                    </button>
                  </div>
                )}

                {/* SMART SUGGESTION MATCH BANNER COGNITIVE extraction */}
                {smartMatches.length > 0 && (
                  <div className="mb-8 bg-surface-container-low rounded-xl p-6 border border-primary-container shadow-sm">
                    <div className="flex items-center gap-2 text-primary font-headline-md font-bold mb-4">
                      <Bot className="h-6 w-6" />
                      {t('search.smartSuggestions')}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {smartMatches.map(({ report, score }) => {
                        const pct = Math.round(score * 100);
                        return (
                          <div
                            key={report.id}
                            onClick={() => {
                              setSelectedItemId(report.id);
                              setActiveTab("itemDetail");
                            }}
                            className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant hover:border-primary cursor-pointer hover:shadow-md transition-all group"
                          >
                            <div className="font-headline-md text-base font-semibold text-on-surface mb-1 group-hover:text-primary transition-colors line-clamp-1">{report.title}</div>
                            <div className="flex items-center text-sm text-on-surface-variant mb-2">
                              <MapPin className="h-3.5 w-3.5 mr-1" />{" "}
                              <span className="truncate">{report.location || "Unknown"}</span>
                            </div>
                            <div className="flex items-center text-xs font-bold text-primary">
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />{" "}
                              {t('search.aiMatchConfidence', { percent: pct })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Results Grid */}
                <div className="mb-6 flex justify-between items-end">
                  <h2 className="font-headline-md text-2xl font-bold text-on-surface">
                    {t('search.searchResultsStart')}<span className="text-on-surface-variant font-body-md font-normal ml-2 text-lg">({filteredSearchList.length}{t('search.searchResultsEnd')}</span>
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-8">
                  {filteredSearchList.map((r) => {
                    const pinned = pinnedIds.includes(r.id);
                    return (
                      <div
                        key={r.id}
                        onClick={() => {
                          setSelectedItemId(r.id);
                          setActiveTab("itemDetail");
                        }}
                        className="bg-surface-container-lowest rounded-xl overflow-hidden border border-outline-variant shadow-sm hover:shadow-md transition-all group flex flex-col cursor-pointer"
                      >
                        <div className="h-48 relative overflow-hidden bg-surface-variant flex items-center justify-center">
                          {r.image || r.imageUrl ? (
                            <img
                              src={r.image || r.imageUrl}
                              alt={r.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="opacity-30 text-outline">
                              <Camera className="h-12 w-12" />
                            </div>
                          )}
                          <div className={`absolute top-3 left-3 px-3 py-1 rounded-full font-label-md text-xs font-semibold tracking-wide uppercase flex items-center gap-1 shadow-sm ${
                            r.claimed ? 'bg-primary-container text-on-primary-container' : 
                            r.type === 'found' ? 'bg-secondary-container text-on-secondary-container' : 'bg-error-container text-on-error-container'
                          }`}>
                            {r.claimed ? <CheckCircle2 className="h-3.5 w-3.5" /> : r.type === "found" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Search className="h-3.5 w-3.5" />}
                            {r.claimed ? t('search.claimed') : r.type === "found" ? t('search.found') : t('search.lost')}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePin(r.id);
                            }}
                            className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${pinned ? "bg-tertiary text-on-tertiary shadow-md" : "bg-surface/80 backdrop-blur-sm text-on-surface-variant hover:text-primary"}`}
                          >
                            <MapPin className="h-4.5 w-4.5" fill={pinned ? "currentColor" : "none"} />
                          </button>
                        </div>
                        <div className="p-4 flex-1 flex flex-col">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-headline-md text-base text-on-surface font-semibold line-clamp-1 group-hover:text-primary transition-colors">{r.title}</h3>
                          </div>
                          <p className="font-body-md text-on-surface-variant line-clamp-2 mb-4 text-sm">
                            {r.desc || r.description || t('search.noDescriptionProvided', 'No description provided.')}
                          </p>
                          <div className="mt-auto space-y-2">
                            <div className="flex items-center text-xs text-on-surface-variant">
                              <MapPin className="h-3.5 w-3.5 mr-1 text-primary shrink-0" />
                              <span className="truncate">{r.location || t('search.unknownLocation', 'Unknown location')}</span>
                            </div>
                            <div className="flex items-center text-xs text-on-surface-variant">
                              <Clock className="h-3.5 w-3.5 mr-1 text-primary shrink-0" />
                              <span>{r.date
                                ? new Date(r.date).toLocaleDateString(i18n.language, {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  })
                                : r.createdAt ? new Date(r.createdAt.seconds ? r.createdAt.seconds * 1000 : r.createdAt).toLocaleDateString(i18n.language) : t('search.recent', 'Recent')}</span>
                            </div>
                          </div>
                        </div>
                        <div className="px-4 py-3 border-t border-outline-variant bg-surface-container-lowest">
                          <button className={`w-full py-2 rounded font-label-md text-sm transition-colors text-center block shadow-sm ${
                            r.type === 'found' ? 'bg-primary text-on-primary hover:bg-primary-dim' : 'border border-primary text-primary hover:bg-primary-container/20'
                          }`}>
                            {t('search.viewDetails')}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {filteredSearchList.length === 0 && (
                  <div className="py-16 flex flex-col items-center justify-center text-center border-2 border-dashed border-outline-variant rounded-xl bg-surface-container-lowest">
                    <div className="w-16 h-16 bg-primary-container/30 rounded-full flex items-center justify-center mb-4 border border-primary-container">
                      <Search className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="font-headline-md text-lg font-bold text-on-surface mb-2">{t('search.noItemsFound')}</h3>
                    <p className="font-body-md text-on-surface-variant">{t('search.tryAdjustingFilters')}</p>
                  </div>
                )}
              </div>
            </section>
{/* PANEL: ITEM DETAIL VIEW */}
            <section
              id="itemDetail"
              className={`${activeTab === "itemDetail" ? "block" : "hidden"} bg-background h-full w-full overflow-y-auto`}
            >
              {(() => {
                const r = items.find((x) => x.id === selectedItemId);
                if (!r)
                  return (
                    <div className="flex flex-col items-center justify-center h-full text-on-surface-variant">
                      <Package className="h-12 w-12 mb-4 opacity-50" />
                      <p>Please choose an item from search.</p>
                    </div>
                  );

                const isOwner = user && r.userId === user.uid;
                const hasSecurityQuestion = !!r.securityQuestion && r.securityQuestion.trim().length > 0;
                const existingClaimForThisUser = myClaims.find(c => c.itemId === r.id);
                const isUnlocked = isOwner || !hasSecurityQuestion || (existingClaimForThisUser && existingClaimForThisUser.status === 'approved');

                return (
                  <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 pb-12">
                    {/* Page Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-variant pb-6">
                      <div>
                        <button
                          onClick={() => setActiveTab("search")}
                          className="inline-flex items-center gap-2 text-primary hover:text-primary-dim text-[12px] font-label-md mb-2 transition-colors"
                        >
                          <ArrowLeft className="h-4 w-4" />
                          Back to Results
                        </button>
                        <div className="flex items-center gap-3 mt-1">
                          <span className={`px-3 py-1 text-[10px] font-bold tracking-wider rounded-full uppercase ${r.type === "lost" ? "bg-error-container text-on-error-container" : "bg-secondary-container text-on-secondary-container"}`}>
                            {r.type === 'lost' ? t('dashboard.lost').toUpperCase() : t('dashboard.found').toUpperCase()}
                          </span>
                          <span className="text-on-surface-variant text-[12px] font-label-md border-l border-outline-variant pl-3">
                            Ref #{r.id.substring(0, 8).toUpperCase()}
                          </span>
                        </div>
                        <h2 className="text-2xl sm:text-[32px] sm:leading-[40px] font-headline-lg font-bold text-on-surface mt-3">
                          {r.title}
                        </h2>
                      </div>
                      <button className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high transition-colors text-primary shadow-sm border border-outline-variant">
                        <Share className="h-5 w-5" />
                      </button>
                    </div>

                    {/* Content Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      {/* Left Column (Image & AI) */}
                      <div className="lg:col-span-7 space-y-6">
                        {/* Image Card */}
                        <div className="bg-surface rounded-xl shadow-sm border border-surface-container-highest overflow-hidden relative aspect-video sm:aspect-[4/3] group">
                          {r.image || r.imageUrl ? (
                            <img
                              src={r.image || r.imageUrl}
                              alt={r.title}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-surface-variant text-outline">
                              <Camera className="h-16 w-16 opacity-30" />
                            </div>
                          )}
                          {/* Carousel Dots Overlay */}
                          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-10">
                            <div className="w-2 h-2 rounded-full bg-surface-container-lowest shadow-sm"></div>
                            <div className="w-2 h-2 rounded-full bg-surface-container-lowest/50 hover:bg-surface-container-lowest/80 cursor-pointer shadow-sm"></div>
                            <div className="w-2 h-2 rounded-full bg-surface-container-lowest/50 hover:bg-surface-container-lowest/80 cursor-pointer shadow-sm"></div>
                          </div>
                        </div>

                        {/* Gemini AI Matchmaker Card */}
                        <div className="bg-surface-container-low rounded-xl p-4 sm:p-6 border border-primary-container relative overflow-hidden shadow-sm">
                          <div className="absolute inset-0 opacity-20 pointer-events-none"></div>
                          <div className="relative z-10 flex gap-4 items-start">
                            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary-container flex items-center justify-center text-on-primary-container shadow-inner">
                              <Bot className="h-7 w-7" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <h3 className="text-[16px] font-headline-md font-semibold text-primary">
                                  Gemini AI Matchmaker
                                </h3>
                                <button className="text-on-surface-variant hover:text-primary transition-colors">
                                  <RefreshCw className="h-5 w-5" />
                                </button>
                              </div>
                              <p className="text-[14px] font-body-md text-on-surface-variant leading-relaxed mb-3">
                                Our AI is actively cross-referencing this report against recent {r.type === 'lost' ? 'Found' : 'Lost'} listings in the area.
                              </p>
                              <div className="flex items-center gap-2 text-primary text-[12px] font-bold animate-pulse">
                                <Search className="h-4 w-4" /> Scanning local databases...
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Column (Details & Contact) */}
                      <div className="lg:col-span-5 space-y-6">
                        {/* Item Details Card */}
                        <div className="bg-surface rounded-xl shadow-sm border border-surface-container-highest p-4 sm:p-6 lg:p-6 space-y-6">
                          <h3 className="text-[24px] font-headline-md font-semibold text-on-surface border-b border-surface-variant pb-3">
                            Item Details
                          </h3>
                          <div className="space-y-4">
                            <div className="flex items-start gap-3">
                              <Tag className="h-5 w-5 text-primary mt-0.5" />
                              <div>
                                <p className="text-[12px] font-label-md text-on-surface-variant mb-0.5">
                                  Category
                                </p>
                                <p className="text-[14px] font-body-md text-on-surface font-medium capitalize">
                                  {(r as any).category || "General"}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <Clock className="h-5 w-5 text-primary mt-0.5" />
                              <div>
                                <p className="text-[12px] font-label-md text-on-surface-variant mb-0.5">
                                  Date Logged
                                </p>
                                <p className="text-[14px] font-body-md text-on-surface font-medium">
                                  {r.createdAt ? new Date(r.createdAt.seconds ? r.createdAt.seconds * 1000 : r.createdAt).toLocaleDateString() : 'Recent'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <MapPin className="h-5 w-5 text-primary mt-0.5" />
                              <div>
                                <p className="text-[12px] font-label-md text-on-surface-variant mb-0.5">
                                  Location
                                </p>
                                <p className="text-[14px] font-body-md text-on-surface font-medium">
                                  {r.location}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="pt-4 border-t border-surface-variant">
                            <p className="text-[12px] font-label-md text-on-surface-variant mb-2">
                              Description
                            </p>
                            <p className="text-[14px] font-body-md text-on-surface bg-surface-container rounded-xl p-3 border border-outline-variant/30 leading-relaxed whitespace-pre-wrap">
                              {r.desc || r.description || "No description provided."}
                            </p>
                          </div>
                        </div>

                        {/* Contact Credentials Card */}
                        <div className="bg-surface rounded-xl shadow-sm border border-surface-container-highest p-4 sm:p-6 lg:p-6 space-y-6">
                          <h3 className="text-[24px] font-headline-md font-semibold text-on-surface border-b border-surface-variant pb-3">
                            Contact Credentials
                          </h3>
                          <div className="flex items-center gap-4 bg-surface-container p-3 rounded-xl border border-outline-variant/30">
                            <div className="w-12 h-12 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container text-[24px] font-bold">
                              {r.contactName ? r.contactName.charAt(0).toUpperCase() : "U"}
                            </div>
                            <div className="flex-1 overflow-hidden">
                              <p className="text-[12px] font-label-md text-on-surface-variant">
                                Reporter
                              </p>
                              <div className="flex items-center gap-1.5">
                                <p className="text-[14px] font-headline-md font-semibold text-on-surface truncate">
                                  {r.contactName || "Verified Reporter"}
                                </p>
                                <BadgeCheck className="h-4 w-4 text-primary shrink-0" />
                              </div>
                              {isUnlocked ? (
                                <p className="text-[14px] font-body-md text-on-surface font-semibold mt-0.5 select-text break-words bg-primary-container/20 px-2 py-1 rounded border border-primary/10">
                                  {r.contactInfo}
                                </p>
                              ) : (
                                <div className="space-y-1">
                                  <p className="text-[14px] font-body-md text-on-surface-variant mt-0.5 select-none filter blur-[4px] opacity-70">
                                    hidden.email@example.com
                                  </p>
                                  <div className="flex items-center gap-1 text-[11px] text-error font-medium">
                                    <Lock className="h-3 w-3" />
                                    <span>Locked behind Prove-It Layer</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="space-y-3 pt-2">
                            {existingClaimForThisUser && (
                              <div className={`p-3 rounded-xl border text-xs font-medium ${
                                existingClaimForThisUser.status === 'approved' 
                                  ? 'bg-[#e6f4ea] border-[#34a853]/30 text-[#137333]' 
                                  : existingClaimForThisUser.status === 'rejected'
                                  ? 'bg-[#fce8e6] border-[#ea4335]/30 text-[#c5221f]'
                                  : 'bg-[#fef7e0] border-[#fbbc05]/30 text-[#b06000]'
                              }`}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-bold uppercase tracking-wider text-[10px]">Claim Status</span>
                                  <span className="font-bold uppercase tracking-wider text-[10px]">{existingClaimForThisUser.status}</span>
                                </div>
                                <p className="leading-relaxed">
                                  {existingClaimForThisUser.status === 'approved' && "✓ Your ownership proof was approved. Contact credentials are unlocked above."}
                                  {existingClaimForThisUser.status === 'pending' && "⌛ Your claim is currently under manual review by the owner."}
                                  {existingClaimForThisUser.status === 'rejected' && "❌ Your claim was declined by the owner."}
                                </p>
                              </div>
                            )}

                            <button 
                              onClick={() => {
                                if (profileName === 'Guest') {
                                  setShowGuestModal(true);
                                } else {
                                  handleStartChat(r.userId, r.id);
                                }
                              }}
                              className="w-full py-3 bg-primary text-on-primary text-[12px] font-label-md font-bold rounded-xl hover:bg-primary-dim transition-colors shadow-sm flex items-center justify-center gap-2"
                            >
                              <MessageSquare className="h-4 w-4" />
                              Contact Chat Room
                            </button>

                            {/* Show Log Ownership Claim button only if they are not the owner, there's a security question, and they don't have an approved claim. */}
                            {!isOwner && hasSecurityQuestion && (!existingClaimForThisUser || existingClaimForThisUser.status !== 'approved') && (
                              <button 
                                onClick={() => {
                                  if (profileName === 'Guest') {
                                    setShowGuestModal(true);
                                  } else {
                                    setActiveTab("claimItem");
                                  }
                                }}
                                disabled={existingClaimForThisUser?.status === 'pending'}
                                className="w-full py-3 bg-transparent border-2 border-secondary text-secondary hover:bg-secondary-container hover:text-on-secondary-container text-[12px] font-label-md font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                              >
                                <Gavel className="h-4 w-4" />
                                {existingClaimForThisUser?.status === 'pending' ? 'Claim Pending Review' : 'Log Ownership Claim'}
                              </button>
                            )}

                            {/* Bug 1: Delete button visible ONLY to the item's original reporter/owner */}
                            {isOwner && (
                              <button 
                                onClick={() => deleteItem(r.id)}
                                className="w-full py-3 bg-transparent border-2 border-error text-error hover:bg-error-container hover:text-on-error-container text-[12px] font-label-md font-bold rounded-xl transition-colors flex items-center justify-center gap-2 mt-4"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete Listing
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </section>

            {/* PANEL: CLAIM ITEM VIEW */}
            <section
              id="claimItem"
              className={`${activeTab === "claimItem" ? "block" : "hidden"} bg-surface h-full w-full overflow-y-auto relative`}
            >
              {(() => {
                const r = items.find((x) => x.id === selectedItemId);
                if (!r)
                  return (
                    <div className="flex flex-col items-center justify-center h-full text-on-surface-variant relative z-10">
                      <Package className="h-12 w-12 mb-4 opacity-50" />
                      <p>Please choose an item from search to claim.</p>
                    </div>
                  );

                return (
                  <>
                    <div className="absolute top-0 right-0 w-96 h-96 bg-primary-container/20 rounded-full blur-[100px] pointer-events-none"></div>
                    <div className="max-w-6xl mx-auto relative z-10 space-y-6 sm:space-y-8 pb-12">
                      {/* Page Header */}
                      <header className="mb-6 sm:mb-8">
                        <h1 className="text-[32px] leading-[40px] font-headline-lg font-bold text-on-surface mb-2">Log Ownership Claim</h1>
                        <div className="flex items-center gap-2 text-primary">
                          <Shield className="h-5 w-5" fill="currentColor" />
                          <span className="text-[14px] font-body-md font-medium tracking-wide">Prove-It Verification Layer</span>
                        </div>
                      </header>

                      {/* Layout Grid */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* Main Form Area (Left Column) */}
                        <div className="lg:col-span-8 space-y-6 sm:space-y-8">
                          {/* Status Chip */}
                          <div>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary-container text-on-primary-container rounded-full text-[12px] font-label-md shadow-sm border border-primary-fixed/50">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                              Current Claim Item
                            </span>
                          </div>

                          {/* Item Thumbnail Card */}
                          <div className="flex flex-col sm:flex-row gap-4 p-4 bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/40 hover:shadow-md transition-shadow duration-300">
                            {r.image || r.imageUrl ? (
                              <img
                                src={r.image || r.imageUrl}
                                alt={r.title}
                                className="w-full sm:w-40 h-40 object-cover rounded-xl border border-outline-variant/20 flex-shrink-0"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full sm:w-40 h-40 flex items-center justify-center bg-surface-variant rounded-xl border border-outline-variant/20 flex-shrink-0 text-outline">
                                <Camera className="h-10 w-10 opacity-30" />
                              </div>
                            )}
                            <div className="flex flex-col justify-center space-y-3 flex-1">
                              <h2 className="text-[24px] font-headline-md font-semibold text-on-surface">{r.title}</h2>
                              <div className="space-y-1.5 text-on-surface-variant text-[14px] font-body-md">
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-primary-dim shrink-0" />
                                  <span className="truncate">Found at: <strong className="text-on-surface font-medium">{r.location}</strong></span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-primary-dim shrink-0" />
                                  <span>Date Logged: <strong className="text-on-surface font-medium">{r.createdAt ? new Date(r.createdAt.seconds ? r.createdAt.seconds * 1000 : r.createdAt).toLocaleDateString() : 'Recent'}</strong></span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Tag className="h-4 w-4 text-primary-dim shrink-0" />
                                  <span>Item ID: <strong className="text-on-surface font-medium uppercase text-xs">FT-{r.id.substring(0,6)}</strong></span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <ClaimSubmissionForm
                            itemId={r.id}
                            itemTitle={r.title}
                            imageUrl={r.imageUrl || r.image || ""}
                            finderId={r.userId}
                            securityQuestion={r.securityQuestion || 'Describe this item in enough detail to prove ownership (e.g. scratches, contents, background).'}
                            onCancel={() => setActiveTab("itemDetail")}
                            onViewMyClaims={() => {
                              setActiveTab("myitems");
                              setMyItemsTab("claims");
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </section>
{/* PANEL: NOTIFICATIONS & ALERTS */}
            <section
              id="notifications"
              className={`${activeTab === "notifications" ? "block" : "hidden"} flex-1 flex flex-col min-w-0`}
            >
              <div className="pt-8 px-4 md:px-8 pb-32 max-w-5xl mx-auto w-full">
                {selectedReviewClaim ? (
                  <ClaimReviewView 
                    claim={selectedReviewClaim} 
                    item={items.find(i => i.id === selectedReviewClaim.itemId)}
                    onClose={() => setSelectedReviewClaim(null)} 
                    triggerToast={triggerToast} 
                  />
                ) : (
                  <>
                    <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                  <div>
                    <h2 className="font-headline-lg text-3xl font-bold text-on-background mb-2">{t('alerts.pageTitle')}</h2>
                    <p className="font-body-md text-on-surface-variant">{t('alerts.pageSubtitle')}</p>
                  </div>
                  <div className="hidden sm:flex gap-2">
                    <button 
                      onClick={() => markAllAlertsRead()}
                      className="px-4 py-2 rounded-full border border-outline-variant font-label-md text-sm text-on-surface-variant hover:bg-surface-variant transition-colors"
                    >
                      {t('alerts.markAllRead')}
                    </button>
                    <button className="px-4 py-2 rounded-full border border-outline-variant font-label-md text-sm text-on-surface-variant hover:bg-surface-variant transition-colors flex items-center gap-1">
                      <Filter className="h-4 w-4" />
                      {t('alerts.filter')}
                    </button>
                  </div>
                </div>

                {/* Bento Grid Layout for Alerts */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  {/* High Priority Alert - Spans full width on mobile, 8 cols on desktop */}
                  {communityAlertsNotif && (
                    <div className="md:col-span-8 bg-surface-container-lowest rounded-xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-outline-variant/30 hover:shadow-md transition-shadow relative overflow-hidden group cursor-pointer">
                      <div className="absolute top-0 left-0 w-1 h-full bg-error-container"></div>
                      <div className="flex gap-4">
                        <div className="w-12 h-12 rounded-full bg-error-container/20 flex items-center justify-center flex-shrink-0 text-error-container">
                          <AlertTriangle className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-1">
                            <h3 className="font-headline-md text-lg text-on-background">{t('alerts.communitySafetyAlert')}</h3>
                            <span className="font-label-md text-xs text-on-surface-variant whitespace-nowrap ml-2">{t('alerts.justNow')}</span>
                          </div>
                          <p className="font-body-md text-on-surface mb-3">{t('alerts.safetyAlertText')}</p>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-surface-variant text-on-surface-variant font-label-md text-[10px] uppercase tracking-wider">{t('alerts.announcement')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Quick Stat / Summary Card */}
                  <div className={`${communityAlertsNotif ? "md:col-span-4" : "md:col-span-12"} bg-primary text-on-primary rounded-xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden`}>
                    <div className="absolute -right-4 -top-4 opacity-10">
                      <Bell className="w-32 h-32" />
                    </div>
                    <div>
                      <h3 className="font-headline-md text-lg text-on-primary mb-1">{t('alerts.unreadAlerts')}</h3>
                      <p className="font-body-md text-primary-fixed-dim opacity-90">{t('alerts.youHaveNewActivity')}</p>
                    </div>
                    <div className="mt-4 flex items-baseline gap-2">
                      <span className="font-headline-lg text-5xl font-bold leading-none">{activeIncomingClaims.filter(n => !n.isReadByFinder).length}</span>
                      <span className="font-body-md opacity-90">{t('alerts.pendingReviews')}</span>
                    </div>
                  </div>

                  {activeIncomingClaims.map((claim) => {
                    const isUnread = !claim.isReadByFinder;
                    const itemMatch = items.find(i => i.id === claim.itemId);
                    
                    return (
                      <div 
                        key={claim.id}
                        onClick={() => {
                          markAlertRead(claim.id);
                          setSelectedReviewClaim(claim);
                        }}
                        className={`md:col-span-6 bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/30 hover:shadow-md transition-shadow relative cursor-pointer ${!isUnread ? "opacity-80" : ""}`}
                      >
                        {isUnread && <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-primary"></div>}
                        <div className="flex gap-4">
                          <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 bg-secondary-container text-on-secondary-container">
                            <CheckCircle2 className="h-6 w-6" />
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start mb-1">
                              <h3 className="font-headline-md text-lg text-on-background">
                                New claim on "{itemMatch?.title || 'Unknown Item'}"
                              </h3>
                              <span className="font-label-md text-xs text-on-surface-variant">
                                {claim.createdAt ? new Date(claim.createdAt.seconds ? claim.createdAt.seconds * 1000 : claim.createdAt).toLocaleDateString() : t('alerts.recently')}
                              </span>
                            </div>
                            <p className="font-body-md text-sm text-on-surface mb-3 line-clamp-2">Claimant answered your verification question.</p>
                            
                            <div className="flex items-center gap-2 mt-2">
                              {claim.status === 'pending' ? (
                                <span className="inline-flex items-center px-3 py-1 rounded-full bg-tertiary-container text-on-tertiary-container font-label-md text-[11px]">
                                  Pending Review
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-3 py-1 rounded-full bg-surface-variant text-on-surface-variant font-label-md text-[11px]">
                                  {claim.status}
                                </span>
                              )}
                              <span className="text-secondary hover:underline font-label-md text-sm">Review Claim</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {activeIncomingClaims.length === 0 && (
                    <div className="col-span-full py-16 text-center border-2 border-dashed border-outline-variant rounded-xl bg-surface-container-lowest">
                      <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mx-auto mb-4 border border-outline-variant">
                        <Bell className="h-8 w-8 text-outline" />
                      </div>
                      <h3 className="font-headline-md text-lg font-bold text-on-surface mb-2">{t('alerts.youreAllCaughtUp')}</h3>
                      <p className="font-body-md text-on-surface-variant">{t('alerts.noNewNotifications')}</p>
                    </div>
                  )}
                </div>
                
                {activeIncomingClaims.length > 0 && (
                  <div className="mt-8 flex justify-center">
                    <button className="px-6 py-2 rounded-full bg-surface-container text-on-surface border border-outline-variant hover:bg-surface-variant transition-colors font-label-md text-sm shadow-sm">
                      {t('alerts.loadOlderAlerts')}
                    </button>
                  </div>
                )}
                </>
                )}
              </div>
            </section>

{/* PANEL: PROFILE */}
            <section
              id="profile"
              className={`${activeTab === "profile" ? "block" : "hidden"} flex-1 flex flex-col min-w-0`}
            >
              <div className="pt-8 px-4 md:px-8 pb-32 max-w-7xl mx-auto w-full space-y-8">
                {/* Mobile Menu Toggle header would be here, but we are inside the main canvas */}
                <h2 className="font-headline-sm text-3xl font-bold text-on-surface mb-8 hidden md:block">Profile Overview</h2>
                
                {/* Bento Grid Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Profile Header Card (Hero) */}
                  <div className="col-span-1 lg:col-span-12 bg-surface-container-lowest rounded-xl shadow-sm border border-surface-variant overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary-container/20 to-transparent pointer-events-none"></div>
                    <div className="p-6 md:p-8 flex flex-col md:flex-row items-center md:items-start gap-8 relative z-10">
                      {/* Avatar Container with 'Level' Ring */}
                      <div className="relative group cursor-pointer shrink-0">
                        <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-tertiary-container shadow-md overflow-hidden relative bg-primary-container flex items-center justify-center text-5xl font-extrabold text-[#005d49] uppercase">
                          {profileAvatar && (profileAvatar.startsWith("http") || profileAvatar.startsWith("/")) ? (
                            <img 
                              src={profileAvatar} 
                              alt={profileName} 
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const fallback = document.getElementById("profile-avatar-fallback");
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <span 
                            id="profile-avatar-fallback"
                            style={{ display: profileAvatar && (profileAvatar.startsWith("http") || profileAvatar.startsWith("/")) ? 'none' : 'flex' }}
                          >
                            {profileName.charAt(0).toUpperCase()}
                          </span>
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Camera className="h-8 w-8 text-white" />
                          </div>
                        </div>
                        {/* Badge */}
                        <div 
                          onClick={() => setActiveTab("levelRoadmap")}
                          className="absolute -bottom-2 -right-2 bg-tertiary text-on-tertiary hover:bg-tertiary-dim px-3 py-1 rounded-full shadow-md flex items-center gap-1 border-2 border-surface-container-lowest transition-colors cursor-pointer select-none"
                        >
                          <Star className="h-4 w-4 text-on-tertiary" fill="currentColor" />
                          <span className="font-label-md text-[10px] uppercase font-bold tracking-wider">Level {currentUserPointsAndLevel.level}</span>
                        </div>
                      </div>
                      
                      {/* User Info */}
                      <div className="flex-1 text-center md:text-left mt-4 md:mt-0 w-full">
                        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                          <div>
                            <h1 className="font-headline-lg text-4xl text-on-surface">{profileName}</h1>
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-2">
                              <span className="bg-primary-container text-on-primary-container px-3 py-1 rounded-full font-label-md text-sm font-semibold inline-flex items-center gap-1">
                                <Heart className="h-4 w-4" fill="currentColor" />{t('profile.communityMember')}</span>
                              <span className="text-on-surface-variant font-body-md flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                {profileLocation || t('profile.locationNotSet')}
                              </span>
                            </div>
                            <p className="mt-4 font-body-md text-on-surface-variant max-w-2xl">
                              {profileBio || t('profile.updateYourProfileToAddABio')}
                            </p>
                          </div>
                          
                          <div className="flex flex-col sm:flex-row gap-3 shrink-0 w-full lg:w-auto">
                            <button 
                              onClick={() => setActiveTab("levelRoadmap")}
                              className="bg-primary text-on-primary hover:bg-primary-dim px-4 py-2 rounded-xl font-label-md text-sm transition-colors flex items-center justify-center gap-2 shadow-sm shrink-0 w-full sm:w-auto cursor-pointer"
                              style={{ minHeight: "44px" }}
                            >
                              <Trophy className="h-4.5 w-4.5" />
                              <span>View Level Roadmap</span>
                            </button>
                            <button 
                              onClick={() => document.getElementById("profName")?.focus()} 
                              className="bg-surface-container-high border border-outline-variant text-on-surface hover:bg-surface-variant px-4 py-2 rounded-xl font-label-md text-sm transition-colors flex items-center justify-center gap-2 shadow-sm shrink-0 w-full sm:w-auto cursor-pointer"
                              style={{ minHeight: "44px" }}
                            >
                              <Settings className="h-4.5 w-4.5" />
                              {t('profile.editProfile')}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="col-span-1 lg:col-span-4 flex flex-col gap-6">
                    <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-variant p-6 flex-1 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3 mb-4 text-primary">
                        <div className="bg-primary-container p-2 rounded-xl">
                          <Package className="h-5 w-5 text-on-primary-container" />
                        </div>
                        <h3 className="font-headline-md text-lg font-semibold">{t('profile.impactStats')}</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mt-6">
                        <div className="bg-surface-container rounded-xl p-4 text-center">
                          <span className="block font-headline-lg text-primary text-3xl mb-1">{items.filter(i => i.userId === auth.currentUser?.uid).length}</span>
                          <span className="font-label-md text-on-surface-variant uppercase tracking-wide text-[10px]">{t('profile.itemsReported')}</span>
                        </div>
                        <div className="bg-surface-container rounded-xl p-4 text-center">
                          <span className="block font-headline-lg text-secondary text-3xl mb-1">{items.filter(i => i.userId === auth.currentUser?.uid && i.claimed).length}</span>
                          <span className="font-label-md text-on-surface-variant uppercase tracking-wide text-[10px]">{t('profile.reunited')}</span>
                        </div>
                        
                      </div>
                    </div>
                  </div>

                  {/* Personal Information Form */}
                  <div className="col-span-1 lg:col-span-8 bg-surface-container-lowest rounded-xl shadow-sm border border-surface-variant p-6 md:p-8">
                    <h3 className="font-headline-md text-xl text-on-surface mb-6 border-b border-surface-variant pb-4">{t('profile.personalInformation')}</h3>
                    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); handleSaveProfile(); }}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Input Group */}
                        <div>
                          <label className="block font-label-md text-sm text-on-surface-variant mb-2" htmlFor="profName">{t('profile.displayName')}</label>
                          <div className="relative">
                            <input 
                              className="shadow-sm pr-10 pl-3 w-full bg-surface-container-lowest border border-outline rounded-xl py-3 text-on-surface focus:ring-2 focus:ring-primary focus:border-primary transition-shadow font-body-md" 
                              id="profName" 
                              type="text" 
                              value={profileName}
                              onChange={(e) => setProfileName(e.target.value)}
                            />
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                              <UserIcon className="h-5 w-5 text-outline" />
                            </div>
                          </div>
                        </div>
                        
                        <div className="md:col-span-2">
                          <label className="block font-label-md text-sm text-on-surface-variant mb-2" htmlFor="profBio">{t('profile.bio')}</label>
                          <textarea 
                            className="shadow-sm w-full bg-surface-container-lowest border border-outline rounded-xl p-3 text-on-surface focus:ring-2 focus:ring-primary focus:border-primary transition-shadow font-body-md" 
                            id="profBio" 
                            rows={3}
                            placeholder={t("generated.string_431")}
                            value={profileBio}
                            onChange={(e) => setProfileBio(e.target.value)}
                          ></textarea>
                        </div>
                        
                        <div className="md:col-span-2">
                          <label className="block font-label-md text-sm text-on-surface-variant mb-2" htmlFor="profEmail">{t('profile.emailAddress')}</label>
                          <div className="relative">
                            <input 
                              className="pr-10 pl-3 w-full bg-surface-container-lowest border border-outline rounded-xl py-2.5 text-on-surface opacity-70 cursor-not-allowed font-body-md" 
                              id="profEmail" 
                              type="email" 
                              value={profileEmail || "No email"}
                              disabled
                            />
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                              <Mail className="h-5 w-5 text-outline" />
                            </div>
                          </div>
                          {auth.currentUser?.emailVerified && (
                            <p className="text-xs text-on-surface-variant mt-1 ml-1 flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />{t('profile.emailVerified')}</p>
                          )}
                        </div>
                        
                        <div>
                          <label className="block font-label-md text-sm text-on-surface-variant mb-2" htmlFor="profPhone">{t('profile.phoneNumber')}</label>
                          <div className="relative">
                            <input 
                              className="shadow-sm pr-8 pl-3 w-full bg-surface-container-lowest border border-outline rounded-xl py-3 text-on-surface focus:ring-2 focus:ring-primary focus:border-primary transition-shadow font-body-md" 
                              id="profPhone" 
                              type="tel" 
                              value={profileContact}
                              onChange={(e) => setProfileContact(e.target.value)}
                            />
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                              <span className="text-outline font-body-md">+</span>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block font-label-md text-sm text-on-surface-variant mb-2" htmlFor="profLoc">{t('profile.primaryLocation')}</label>
                          <div className="relative">
                            <input 
                              className="shadow-sm pr-10 pl-3 w-full bg-surface-container-lowest border border-outline rounded-xl py-3 text-on-surface focus:ring-2 focus:ring-primary focus:border-primary transition-shadow font-body-md" 
                              id="profLoc" 
                              type="text" 
                              value={profileLocation}
                              onChange={(e) => setProfileLocation(e.target.value)}
                            />
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                              <MapPin className="h-5 w-5 text-outline" />
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex justify-end pt-4">
                        <button 
                          className="bg-primary hover:bg-primary-dim text-on-primary font-label-md text-sm py-2.5 px-6 rounded-xl shadow-sm transition-colors" 
                          type="submit"
                        >{t('profile.saveChanges')}</button>
                      </div>
                    </form>
                  </div>

                  {/* Settings & Preferences */}
                  <div className="col-span-1 lg:col-span-12 bg-surface-container-lowest rounded-xl shadow-sm border border-surface-variant overflow-hidden">
                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-surface-variant">
                      {/* Notifications */}
                      <div className="p-6 md:p-8">
                        <div className="flex items-center gap-3 mb-6 text-on-surface">
                          <div className="bg-secondary-container p-2 rounded-xl">
                            <Bell className="h-5 w-5 text-on-secondary-container" />
                          </div>
                          <h3 className="font-headline-md text-lg font-semibold">{t('profile.notificationPreferences')}</h3>
                        </div>
                        <div className="space-y-5">
                          <label className="flex items-center justify-between cursor-pointer group">
                            <div>
                              <span className="font-body-md text-on-surface font-medium block">{t('profile.newMatchesForMyItems')}</span>
                              <span className="font-body-md text-xs text-on-surface-variant">{t('profile.getNotifiedWhenAFoundItemMatchesYourReport')}</span>
                            </div>
                            <div className="relative">
                              <input 
                                type="checkbox"
                                checked={newMatchesNotif}
                                onChange={async (e) => {
                                  const newVal = e.target.checked;
                                  setNewMatchesNotif(newVal);
                                  if (auth.currentUser) {
                                    try {
                                      await setDoc(doc(db, "users", auth.currentUser.uid), {
                                        newMatchesNotif: newVal
                                      }, { merge: true });
                                      triggerToast("Preference updated", "success");
                                    } catch (err) {
                                      console.error(err);
                                      triggerToast("❌ Failed to update preference", "error");
                                    }
                                  }
                                }}
                                className="sr-only peer" 
                              />
                              <div className="w-11 h-6 bg-surface-variant peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-surface-container-lowest after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                            </div>
                          </label>
                          <label className="flex items-center justify-between cursor-pointer group">
                            <div>
                              <span className="font-body-md text-on-surface font-medium block">{t('profile.communityAlerts')}</span>
                              <span className="font-body-md text-xs text-on-surface-variant">{t('profile.importantAlertsInYourPrimaryLocation')}</span>
                            </div>
                            <div className="relative">
                              <input 
                                type="checkbox"
                                checked={communityAlertsNotif}
                                onChange={async (e) => {
                                  const newVal = e.target.checked;
                                  setCommunityAlertsNotif(newVal);
                                  if (auth.currentUser) {
                                    try {
                                      await setDoc(doc(db, "users", auth.currentUser.uid), {
                                        communityAlertsNotif: newVal
                                      }, { merge: true });
                                      triggerToast("Preference updated", "success");
                                    } catch (err) {
                                      console.error(err);
                                      triggerToast("❌ Failed to update preference", "error");
                                    }
                                  }
                                }}
                                className="sr-only peer" 
                              />
                              <div className="w-11 h-6 bg-surface-variant peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-surface-container-lowest after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                            </div>
                          </label>
                        </div>
                      </div>
                      
                      {/* Security */}
                      <div className="p-6 md:p-8">
                        <div className="flex items-center gap-3 mb-6 text-on-surface">
                          <div className="bg-surface-variant p-2 rounded-xl">
                            <Lock className="h-5 w-5 text-on-surface-variant" />
                          </div>
                          <h3 className="font-headline-md text-lg font-semibold">{t('profile.security')}</h3>
                        </div>
                        <div className="space-y-4">
                          <button onClick={async () => { if (auth.currentUser?.email) { try { const { sendPasswordResetEmail } = await import("firebase/auth"); await sendPasswordResetEmail(auth, auth.currentUser.email); triggerToast("Password reset email sent", "success"); } catch (e) { triggerToast("Failed to send reset email", "error"); } } else { triggerToast("No email associated with account", "error"); } }} className="w-full flex items-center justify-between p-4 rounded-xl border border-outline-variant hover:bg-surface-variant transition-colors group">
                            <div className="flex items-center gap-3 text-left">
                              <Key className="h-5 w-5 text-on-surface-variant" />
                              <div>
                                <span className="block font-body-md font-medium text-on-surface">{t('profile.changePassword')}</span>
                                <span className="block text-xs text-on-surface-variant mt-0.5">{t('profile.updateYourSecurityCredentials')}</span>
                              </div>
                            </div>
                            <ArrowRight className="h-5 w-5 text-on-surface-variant group-hover:text-primary transition-colors" />
                          </button>
                          
                          <div className="pt-4 mt-4 border-t border-surface-variant">
                            <button 
                              onClick={handleLogoutAction}
                              className="text-error hover:text-error-dim font-label-md text-sm flex items-center gap-2 transition-colors w-full p-2"
                            >
                              <LogOut className="h-5 w-5" />{t('profile.signOutEverywhere')}</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
{/* PANEL: LEVEL ROADMAP */}
            <section
              id="levelRoadmap"
              className={`${activeTab === "levelRoadmap" ? "block" : "hidden"} flex-1 flex flex-col min-w-0`}
            >
              <LevelRoadmap 
                items={items}
                userId={auth.currentUser?.uid}
                profileName={profileName}
                profileLocation={profileLocation}
                profileBio={profileBio}
                onBack={() => setActiveTab("profile")}
              />
            </section>
{/* PANEL: MY ITEMS */}
            <section
              id="myitems"
              className={`${activeTab === "myitems" ? "block" : "hidden"} `}
            >
              <div className="p-4 md:p-8">
                {/* Dashboard Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 space-y-4 md:space-y-0">
                  <div>
                    <h2 className="font-headline-lg text-3xl font-bold text-on-background mb-1">{t('sidebar.myItems', 'My Items')}</h2>
                    <p className="font-body-lg text-on-surface-variant">{t('generated.string_271', 'Manage and track your reported lost or found items.')}</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab("report")}
                    className="flex items-center gap-2 px-4 py-2 font-label-md font-bold bg-primary text-on-primary rounded-xl shadow-sm hover:bg-primary-dim transition-colors"
                  >
                    <PlusCircle className="h-4 w-4" /> {t('generated.string_272', 'Report New')}
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex space-x-8 border-b border-outline-variant mb-8 overflow-x-auto pb-px">
                  <button 
                    onClick={() => setMyItemsTab('items')}
                    className={`font-label-md text-sm pb-3 px-1 whitespace-nowrap ${myItemsTab === 'items' ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-primary transition-colors'}`}
                  >
                    My Reports ({items.filter(i => i.userId === auth.currentUser?.uid).length})
                  </button>
                  <button 
                    onClick={() => setMyItemsTab('claims')}
                    className={`font-label-md text-sm pb-3 px-1 whitespace-nowrap ${myItemsTab === 'claims' ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-primary transition-colors'}`}
                  >
                    My Claims ({myClaims.length})
                  </button>
                </div>

                {myItemsTab === 'items' ? (
                  <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                      {items
                    .filter((item) => item.userId === auth.currentUser?.uid)
                    .map((r) => {
                      return (
                        <article key={r.id} className="bg-surface-container-lowest rounded-[16px] p-4 md:p-6 shadow-[0_4px_24px_rgba(1,114,90,0.08)] hover:shadow-[0_8px_32px_rgba(1,114,90,0.12)] hover:-translate-y-0.5 transition-all duration-200 flex flex-col h-full border border-surface-variant group">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center space-x-2">
                              {r.claimed ? (
                                <span className="bg-secondary-container text-on-secondary-container px-2 py-1 rounded-full font-label-md text-[10px] uppercase tracking-wider flex items-center space-x-1">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  <span>{t('generated.string_275', 'Match Found')}</span>
                                </span>
                              ) : r.type === "found" ? (
                                <span className="bg-primary-container text-on-primary-container px-2 py-1 rounded-full font-label-md text-[10px] uppercase tracking-wider flex items-center space-x-1">
                                  <Hand className="h-3.5 w-3.5" />
                                  <span>{t('generated.string_276', 'Found')}</span>
                                </span>
                              ) : (
                                <span className="bg-tertiary-container text-on-tertiary-container px-2 py-1 rounded-full font-label-md text-[10px] uppercase tracking-wider flex items-center space-x-1">
                                  <Search className="h-3.5 w-3.5 animate-pulse" />
                                  <span>{t('generated.string_277', 'Searching')}</span>
                                </span>
                              )}
                              <span className="text-on-surface-variant font-label-md text-xs">
                                {r.type === 'found' ? t('search.found', 'Found') : t('search.lost', 'Lost')} • {r.createdAt ? new Date(r.createdAt.seconds ? r.createdAt.seconds * 1000 : r.createdAt).toLocaleDateString() : t('alerts.recently', 'Recent')}
                              </span>
                            </div>
                            <button 
                              onClick={() => deleteItem(r.id)}
                              className="text-on-surface-variant hover:text-error transition-colors"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </div>
                          
                          <div 
                            className="flex space-x-4 mb-4 flex-1 cursor-pointer"
                            onClick={() => {
                              setSelectedItemId(r.id);
                              setActiveTab("itemDetail");
                            }}
                          >
                            <div className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 bg-surface-container flex items-center justify-center text-outline-variant">
                              {r.image || r.imageUrl ? (
                                <img src={r.image || r.imageUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
                              ) : (
                                <ImageIcon className="h-10 w-10 opacity-30" />
                              )}
                            </div>
                            <div>
                              <h3 className="font-headline-md text-lg font-bold text-on-surface mb-1 leading-tight group-hover:text-primary transition-colors line-clamp-2">
                                {r.title}
                              </h3>
                              <div className="flex items-center space-x-1 mt-2 text-primary">
                                <MapPin className="h-4 w-4 shrink-0" />
                                <span className="font-label-md text-[11px] truncate">{r.location}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="pt-4 border-t border-outline-variant flex space-x-3 mt-auto">
                            {r.claimed ? (
                              <>
                                <button className="flex-1 bg-primary text-on-primary py-2 rounded-xl font-label-md text-sm hover:bg-primary-dim transition-colors flex items-center justify-center space-x-2">
                                  <MessageSquare className="h-4.5 w-4.5" />
                                  <span>{t('generated.string_278', 'Message Finder')}</span>
                                </button>
                              </>
                            ) : (
                              <>
                                <button 
                                  onClick={() => {
                                    setSelectedItemId(r.id);
                                    setActiveTab("itemDetail");
                                  }}
                                  className="flex-1 border border-primary text-primary py-2 rounded-xl font-label-md text-sm hover:bg-surface-container transition-colors flex items-center justify-center space-x-2"
                                >
                                  <Eye className="h-4.5 w-4.5" />
                                  <span>{t('search.viewDetails')}</span>
                                </button>
                              </>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  
                  {items.filter((item) => item.userId === auth.currentUser?.uid).length === 0 && (
                    <div className="col-span-full py-16 text-center border-2 border-dashed border-outline-variant rounded-xl bg-surface-container-lowest">
                      <Inbox className="h-12 w-12 text-outline mx-auto mb-4" />
                      <h3 className="font-headline-md text-lg font-bold text-on-surface mb-2">{t('generated.string_279', 'No items yet')}</h3>
                      <p className="font-body-md text-on-surface-variant mb-6">{t('generated.string_280', "You haven't reported any lost or found items.")}</p>
                      <button 
                        onClick={() => setActiveTab("report")}
                        className="inline-flex items-center gap-2 px-6 py-2.5 font-label-md font-bold bg-primary text-on-primary rounded-xl shadow-sm hover:bg-primary-dim transition-colors"
                      >
                        <PlusCircle className="h-4 w-4" /> {t('dashboard.reportAnItem', 'Report an Item')}
                      </button>
                    </div>
                  )}
                    </div>
                  </>
                ) : (
                  <div className="mt-4">
                    <MyClaimsView 
                      claims={myClaims} 
                      onViewItem={(itemId) => {
                        setSelectedItemId(itemId);
                        setActiveTab("itemDetail");
                      }} 
                    />
                  </div>
                )}
              </div>
            </section>
{/* PANEL: PINNED ITEMS */}
            <section
              id="pinned"
              className={`${activeTab === "pinned" ? "block" : "hidden"} flex-1 flex flex-col min-w-0`}
            >
              <div className="pt-8 px-4 md:px-8 pb-32">
                <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                  <div>
                    <h2 className="font-headline-lg text-3xl font-bold text-on-background mb-2">{t('sidebar.pinnedItems', 'Pinned Items')}</h2>
                    <p className="font-body-lg text-on-surface-variant max-w-2xl">{t('generated.string_281', 'Keep track of important community reports. Items you pin will appear here for quick access until they are resolved or you unpin them.')}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-4 py-2 bg-surface-container rounded-xl font-label-md text-sm text-on-surface flex items-center gap-2 hover:bg-surface-container-high transition-colors border border-outline-variant">
                      <Filter className="h-4.5 w-4.5" />
                      {t('search.filter', 'Filter')}
                    </button>
                    <button className="px-4 py-2 bg-surface-container rounded-xl font-label-md text-sm text-on-surface flex items-center gap-2 hover:bg-surface-container-high transition-colors border border-outline-variant">
                      <ArrowDownUp className="h-4.5 w-4.5" />
                      {t('generated.string_282', 'Sort')}
                    </button>
                  </div>
                </div>

                {/* Bento Grid for Pinned Items */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {items
                    .filter((item) => pinnedIds.includes(item.id))
                    .map((r, i) => {
                      const isLarge = i % 5 === 0;
                      return (
                        <div 
                           key={r.id} 
                           className={`${isLarge ? "md:col-span-2 lg:col-span-2 row-span-2" : "col-span-1 row-span-1"} bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_-4px_rgba(1,114,90,0.08)] border border-outline-variant/30 overflow-hidden flex flex-col group relative transition-transform hover:-translate-y-1 duration-300 cursor-pointer`}
                           onClick={() => {
                             setSelectedItemId(r.id);
                             setActiveTab("itemDetail");
                           }}
                        >
                          <div className="absolute top-4 right-4 z-10 flex gap-2">
                            <span className={`${r.claimed ? 'bg-secondary-container text-on-secondary-container' : r.type === 'found' ? 'bg-primary-container text-on-primary-container' : 'bg-tertiary-container text-on-tertiary-container'} px-3 py-1 rounded-full font-label-md text-[10px] font-bold tracking-wider uppercase shadow-sm`}>
                              {r.claimed ? t('search.resolved', 'Resolved') : r.type === "found" ? t('search.found', 'Found') : t('search.lost', 'Lost')}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePin(r.id);
                              }}
                              className="bg-surface-container-lowest/80 backdrop-blur p-2 rounded-full text-primary hover:text-error transition-colors shadow-sm group/btn"
                              title={t('generated.string_283', 'Unpin Item')}
                            >
                              <MapPin className="h-4 w-4 fill-current group-hover/btn:hidden" />
                              <X className="h-4 w-4 hidden group-hover/btn:block text-error" />
                            </button>
                          </div>
                          
                          <div className={`${isLarge ? "h-64" : "h-48"} relative w-full overflow-hidden bg-surface-variant flex items-center justify-center`}>
                            {r.image || r.imageUrl ? (
                              <>
                                <img
                                  src={r.image || r.imageUrl}
                                  alt={r.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                  referrerPolicy="no-referrer"
                                />
                                {isLarge && <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>}
                              </>
                            ) : (
                              <div className="w-full h-full border-2 border-dashed border-outline-variant flex flex-col items-center justify-center text-outline-variant p-4 m-4 rounded-xl bg-surface-container-lowest">
                                <ImageIcon className="h-10 w-10 mb-2 opacity-50" />
                                <span className="font-label-md text-xs text-center opacity-70">{t('generated.string_401', 'No Image Available')}</span>
                              </div>
                            )}
                            
                            {isLarge && (r.image || r.imageUrl) && (
                              <div className="absolute bottom-4 left-4 right-4 text-white">
                                <div className="flex items-center gap-2 mb-1 text-sm opacity-90">
                                  <MapPin className="h-4 w-4" />
                                  <span>{r.location || t('generated.string_284', 'Unknown')}</span>
                                </div>
                                <h3 className="font-headline-md text-2xl font-bold leading-tight line-clamp-1">{r.title}</h3>
                              </div>
                            )}
                          </div>
                          
                          <div className="p-5 flex-1 flex flex-col">
                            {(!isLarge || (!r.image && !r.imageUrl)) && (
                              <h3 className="font-headline-sm text-xl font-bold text-on-surface mb-1 line-clamp-1 group-hover:text-primary transition-colors">{r.title}</h3>
                            )}
                            
                            {(!isLarge || (!r.image && !r.imageUrl)) && (
                              <div className="flex items-center gap-1 text-on-surface-variant text-sm mb-3">
                                <MapPin className="h-3.5 w-3.5 text-primary" />
                                <span className="truncate">{r.location || t('generated.string_284', 'Unknown')}</span>
                              </div>
                            )}
                            
                            <p className="font-body-md text-on-surface-variant line-clamp-3 mb-4 text-sm">
                              {r.desc || r.description || t('generated.string_285', 'No description provided.')}
                            </p>
                            
                            <div className="mt-auto pt-4 border-t border-surface-variant flex justify-between items-center">
                              {isLarge ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-surface-container-high border border-outline-variant flex items-center justify-center text-xs font-bold text-on-surface">
                                    {r.contactName ? r.contactName.charAt(0).toUpperCase() : "U"}
                                  </div>
                                  <span className="font-label-md text-xs text-on-surface">{t('generated.string_286', 'Reported by')} {r.contactName || "User"}</span>
                                </div>
                              ) : (
                                <span className="font-label-md text-xs text-outline flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {t('generated.string_287', 'Pinned')} {r.createdAt ? new Date(r.createdAt.seconds ? r.createdAt.seconds * 1000 : r.createdAt).toLocaleDateString() : t('alerts.recently', 'Recently')}
                                </span>
                              )}
                              
                              <button className="text-primary font-label-md text-sm hover:underline flex items-center gap-1">
                                {t('search.viewDetails')} {isLarge && <ArrowRight className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  
                  {items.filter((item) => pinnedIds.includes(item.id)).length === 0 && (
                    <div className="col-span-full py-16 text-center border-2 border-dashed border-outline-variant rounded-xl bg-surface-container-lowest">
                      <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mx-auto mb-4 border border-outline-variant">
                        <MapPin className="h-8 w-8 text-outline" />
                      </div>
                      <h3 className="font-headline-md text-lg font-bold text-on-surface mb-2">{t('generated.string_288', 'No pinned items')}</h3>
                      <p className="font-body-md text-on-surface-variant mb-6">{t('generated.string_289', "You haven't bookmarked any items yet.")}</p>
                      <button 
                        onClick={() => setActiveTab("search")}
                        className="inline-flex items-center gap-2 px-6 py-2.5 font-label-md font-bold bg-primary text-on-primary rounded-xl shadow-sm hover:bg-primary-dim transition-colors"
                      >
                        <Search className="h-4 w-4" /> {t('generated.string_290', 'Browse Items')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </section>
{/* PANEL: CATEGORIES BROWSER */}
            <section
              id="categories"
              className={`${activeTab === "categories" ? "block" : "hidden"} flex-1 flex flex-col min-w-0`}
            >
              <div className="pt-8 px-4 md:px-8 pb-32 max-w-7xl mx-auto w-full">
                {/* Page Header */}
                <div className="mb-12">
                  <h2 className="font-headline-lg text-4xl font-bold text-primary mb-2">{t('sidebar.categories', 'Browse Categories')}</h2>
                  <p className="font-body-lg text-on-surface-variant max-w-2xl">{t('categories.desc', "Find what you're looking for by exploring our organized categories. We've classified items to help you navigate through reports efficiently.")}</p>
                </div>
                
                {/* Bento Grid for Categories */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 auto-rows-[200px]">
                  {/* Electronics (Large Featured) */}
                  <div 
                    className="col-span-1 sm:col-span-2 lg:col-span-2 row-span-2 rounded-xl bg-surface-container-lowest shadow-[0_4px_20px_rgba(1,114,90,0.05)] hover:shadow-[0_8px_30px_rgba(1,114,90,0.1)] hover:-translate-y-1 p-8 flex flex-col justify-between group overflow-hidden relative border border-outline-variant/30 transition-all duration-300 cursor-pointer"
                    onClick={() => {
                      setCategoryKeywords(["phone", "laptop", "tablet", "charger", "headphone", "earphone", "computer", "iphone", "samsung", "ipad", "macbook"]);
                      setActiveTab("search");
                    }}
                  >
                    <div className="absolute -right-10 -bottom-10 opacity-5 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none">
                      <Smartphone className="w-72 h-72 text-primary" />
                    </div>
                    <div className="relative z-10 flex justify-between items-start">
                      <div className="bg-primary-container p-3 rounded-xl inline-flex">
                        <Smartphone className="text-on-primary-container h-8 w-8" />
                      </div>
                      <span className="bg-surface-variant text-on-surface-variant font-label-md text-xs px-3 py-1 rounded-full border border-outline-variant/20">
                        {items.filter(i => ["phone", "laptop", "tablet", "charger", "headphone", "earphone", "computer", "iphone", "samsung", "ipad", "macbook"].some(kw => (i?.title || "").toLowerCase().includes(kw) || (i?.desc || "").toLowerCase().includes(kw))).length} {t('categories.active', 'Active')}
                      </span>
                    </div>
                    <div className="relative z-10 mt-auto">
                      <h3 className="font-headline-md text-3xl font-bold text-primary mb-2 group-hover:text-primary-dim transition-colors">{t('categories.electronics', 'Electronics')}</h3>
                      <p className="font-body-md text-base text-on-surface-variant max-w-sm">{t('categories.electronics_desc', 'Phones, laptops, tablets, and other digital devices reported lost or found recently.')}</p>
                    </div>
                  </div>

                  {/* Bags & Luggage */}
                  <div 
                    className="col-span-1 rounded-xl bg-surface-container-lowest shadow-[0_4px_20px_rgba(1,114,90,0.05)] hover:shadow-[0_8px_30px_rgba(1,114,90,0.1)] hover:-translate-y-1 p-6 flex flex-col justify-between group relative overflow-hidden border border-outline-variant/30 transition-all duration-300 cursor-pointer"
                    onClick={() => {
                      setCategoryKeywords(["bag", "backpack", "purse", "wallet", "luggage", "suitcase", "handbag"]);
                      setActiveTab("search");
                    }}
                  >
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none">
                      <Package className="w-36 h-36 text-tertiary" />
                    </div>
                    <div className="relative z-10 flex justify-between items-start">
                      <div className="bg-tertiary-container p-2 rounded-xl inline-flex">
                        <Package className="text-on-tertiary-container h-6 w-6" />
                      </div>
                      <span className="bg-surface-variant text-on-surface-variant font-label-md text-[10px] px-2 py-1 rounded-full">
                        {items.filter(i => ["bag", "backpack", "purse", "wallet", "luggage", "suitcase", "handbag"].some(kw => (i?.title || "").toLowerCase().includes(kw) || (i?.desc || "").toLowerCase().includes(kw))).length} {t('categories.active', 'Active')}
                      </span>
                    </div>
                    <div className="relative z-10 mt-auto">
                      <h3 className="font-body-lg text-lg font-bold text-on-surface mb-1 group-hover:text-tertiary transition-colors">{t('categories.bags', 'Bags & Luggage')}</h3>
                      <p className="font-body-md text-sm text-on-surface-variant line-clamp-2">{t('categories.bags_desc', 'Backpacks, purses, suitcases and other carry-ons.')}</p>
                    </div>
                  </div>

                  {/* Pets */}
                  <div 
                    className="col-span-1 rounded-xl bg-surface-container-lowest shadow-[0_4px_20px_rgba(1,114,90,0.05)] hover:shadow-[0_8px_30px_rgba(1,114,90,0.1)] hover:-translate-y-1 p-6 flex flex-col justify-between group relative overflow-hidden border border-outline-variant/30 transition-all duration-300 cursor-pointer"
                    onClick={() => {
                      setCategoryKeywords(["dog", "cat", "pet", "bird", "animal", "puppy", "kitten", "collar"]);
                      setActiveTab("search");
                    }}
                  >
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none">
                      <Heart className="w-36 h-36 text-error" />
                    </div>
                    <div className="relative z-10 flex justify-between items-start">
                      <div className="bg-[#ffdcdc] p-2 rounded-xl inline-flex">
                        <Heart className="text-error h-6 w-6" fill="currentColor" />
                      </div>
                      <span className="bg-surface-variant text-on-surface-variant font-label-md text-[10px] px-2 py-1 rounded-full">
                        {items.filter(i => ["dog", "cat", "pet", "bird", "animal", "puppy", "kitten", "collar"].some(kw => (i?.title || "").toLowerCase().includes(kw) || (i?.desc || "").toLowerCase().includes(kw))).length} {t('categories.active', 'Active')}
                      </span>
                    </div>
                    <div className="relative z-10 mt-auto">
                      <h3 className="font-body-lg text-lg font-bold text-on-surface mb-1 group-hover:text-error transition-colors">{t('categories.pets', 'Pets & Animals')}</h3>
                      <p className="font-body-md text-sm text-on-surface-variant line-clamp-2">{t('categories.pets_desc', 'Lost dogs, cats, and other companion animals.')}</p>
                    </div>
                  </div>

                  {/* Documents (Tall) */}
                  <div 
                    className="col-span-1 sm:col-span-1 row-span-2 rounded-xl bg-surface-container-lowest shadow-[0_4px_20px_rgba(1,114,90,0.05)] hover:shadow-[0_8px_30px_rgba(1,114,90,0.1)] hover:-translate-y-1 p-6 flex flex-col justify-between group relative overflow-hidden border border-outline-variant/30 transition-all duration-300 cursor-pointer"
                    onClick={() => {
                      setCategoryKeywords(["document", "id", "passport", "license", "card", "paper", "folder"]);
                      setActiveTab("search");
                    }}
                  >
                    <div className="absolute top-0 right-0 w-full h-full opacity-[0.03] group-hover:opacity-[0.05] transition-opacity duration-500 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary via-transparent to-transparent pointer-events-none"></div>
                    <div className="relative z-10 flex justify-between items-start mb-4">
                      <div className="bg-secondary-container p-3 rounded-xl inline-flex">
                        <FileText className="text-on-secondary-container h-8 w-8" />
                      </div>
                      <span className="bg-surface-variant text-on-surface-variant font-label-md text-[10px] px-2 py-1 rounded-full">
                        {items.filter(i => ["document", "id", "passport", "license", "card", "paper", "folder"].some(kw => (i?.title || "").toLowerCase().includes(kw) || (i?.desc || "").toLowerCase().includes(kw))).length} {t('categories.active', 'Active')}
                      </span>
                    </div>
                    <div className="relative z-10 mt-auto">
                      <h3 className="font-body-lg text-2xl font-bold text-secondary mb-2 group-hover:text-primary transition-colors">{t('categories.documents', 'Documents & IDs')}</h3>
                      <p className="font-body-md text-sm text-on-surface-variant mb-4">{t('categories.documents_desc', "Passports, driver's licenses, IDs, and important paperwork.")}</p>
                      {items.filter(i => ["document", "id", "passport", "license", "card", "paper", "folder"].some(kw => (i?.title || "").toLowerCase().includes(kw) || (i?.desc || "").toLowerCase().includes(kw))).length > 0 && (
                        <div className="flex items-center text-primary font-label-md text-xs group-hover:translate-x-1 transition-transform">
                          {t('categories.explore', 'Explore')} <ArrowRight className="h-4 w-4 ml-1" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Clothing */}
                  <div 
                    className="col-span-1 sm:col-span-1 row-span-1 rounded-xl bg-surface-container-lowest shadow-[0_4px_20px_rgba(1,114,90,0.05)] hover:shadow-[0_8px_30px_rgba(1,114,90,0.1)] hover:-translate-y-1 p-6 flex flex-col justify-between group relative overflow-hidden border border-outline-variant/30 transition-all duration-300 cursor-pointer"
                    onClick={() => {
                      setCategoryKeywords(["jacket", "shirt", "pants", "uniform", "shoes", "hat", "scarf", "coat", "clothing"]);
                      setActiveTab("search");
                    }}
                  >
                    <div className="relative z-10 flex justify-between items-start">
                      <div className="bg-surface-variant p-2 rounded-xl inline-flex">
                        <Tag className="text-on-surface h-6 w-6" />
                      </div>
                      <span className="bg-surface-variant text-on-surface-variant font-label-md text-[10px] px-2 py-1 rounded-full">
                        {items.filter(i => ["jacket", "shirt", "pants", "uniform", "shoes", "hat", "scarf", "coat", "clothing"].some(kw => (i?.title || "").toLowerCase().includes(kw) || (i?.desc || "").toLowerCase().includes(kw))).length} {t('categories.active', 'Active')}
                      </span>
                    </div>
                    <div className="relative z-10 mt-auto">
                      <h3 className="font-body-lg text-lg font-bold text-on-surface mb-1 group-hover:text-primary transition-colors">{t('categories.clothing', 'Clothing')}</h3>
                    </div>
                  </div>

                  {/* Jewelry & Watches */}
                  <div 
                    className="col-span-1 sm:col-span-1 row-span-1 rounded-xl bg-surface-container-lowest shadow-[0_4px_20px_rgba(1,114,90,0.05)] hover:shadow-[0_8px_30px_rgba(1,114,90,0.1)] hover:-translate-y-1 p-6 flex flex-col justify-between group relative overflow-hidden border border-outline-variant/30 transition-all duration-300 cursor-pointer"
                    onClick={() => {
                      setCategoryKeywords(["ring", "necklace", "bracelet", "watch", "earring", "jewelry", "diamond", "gold", "silver"]);
                      setActiveTab("search");
                    }}
                  >
                    <div className="relative z-10 flex justify-between items-start">
                      <div className="bg-surface-variant p-2 rounded-xl inline-flex">
                        <Clock className="text-on-surface h-6 w-6" />
                      </div>
                      <span className="bg-surface-variant text-on-surface-variant font-label-md text-[10px] px-2 py-1 rounded-full">
                        {items.filter(i => ["ring", "necklace", "bracelet", "watch", "earring", "jewelry", "diamond", "gold", "silver"].some(kw => (i?.title || "").toLowerCase().includes(kw) || (i?.desc || "").toLowerCase().includes(kw))).length} {t('categories.active', 'Active')}
                      </span>
                    </div>
                    <div className="relative z-10 mt-auto">
                      <h3 className="font-body-lg text-lg font-bold text-on-surface mb-1 group-hover:text-primary transition-colors">{t('categories.jewelry', 'Jewelry & Watches')}</h3>
                    </div>
                  </div>

                  {/* Keys */}
                  <div 
                    className="col-span-1 sm:col-span-1 row-span-1 rounded-xl bg-surface-container-lowest shadow-[0_4px_20px_rgba(1,114,90,0.05)] hover:shadow-[0_8px_30px_rgba(1,114,90,0.1)] hover:-translate-y-1 p-6 flex flex-col justify-between group relative overflow-hidden border border-outline-variant/30 transition-all duration-300 cursor-pointer"
                    onClick={() => {
                      setCategoryKeywords(["key", "keychain", "fob", "car key"]);
                      setActiveTab("search");
                    }}
                  >
                    <div className="relative z-10 flex justify-between items-start">
                      <div className="bg-surface-variant p-2 rounded-xl inline-flex">
                        <Key className="text-on-surface h-6 w-6" />
                      </div>
                      <span className="bg-surface-variant text-on-surface-variant font-label-md text-[10px] px-2 py-1 rounded-full">
                        {items.filter(i => ["key", "keychain", "fob", "car key"].some(kw => (i?.title || "").toLowerCase().includes(kw) || (i?.desc || "").toLowerCase().includes(kw))).length} {t('categories.active', 'Active')}
                      </span>
                    </div>
                    <div className="relative z-10 mt-auto">
                      <h3 className="font-body-lg text-lg font-bold text-on-surface mb-1 group-hover:text-primary transition-colors">{t('search.keys', 'Keys')}</h3>
                    </div>
                  </div>
                </div>
              </div>
            </section>
{/* PANEL: ANALYTICS DESK */}
            <section
              id="analytics"
              className={`panel ${activeTab === "analytics" ? "active" : ""}`}
            >
              {/* Header */}
              <div className="flex flex-col gap-1 mb-6 border-b border-outline-variant/50 pb-4">
                <h2 className="text-2xl font-bold tracking-tight text-primary font-sans flex items-center gap-2">
                  <BarChart2 className="h-6 w-6 text-primary" /> {t('generated.string_304', 'Analytics Dashboard')}
                </h2>
                <p className="text-sm text-on-surface-variant">
                  {t('generated.string_305', 'Real-time visual metrics and recovery performance of reported items from Firestore.')}
                </p>
              </div>

              {/* Bento Grid Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/50 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">{t('generated.string_306', 'Active Lost Reports')}</span>
                    <span className="p-2 rounded-xl bg-red-50 text-error">
                      <Archive className="h-4 w-4" />
                    </span>
                  </div>
                  <div>
                    <div className="text-3xl font-extrabold text-on-surface tracking-tight font-sans">
                      {stats.lost}
                    </div>
                    <p className="text-xs text-on-surface-variant mt-1 flex items-center gap-1">
                      <span className="font-semibold text-error">{t('generated.string_307', 'Currently active')}</span> {t('generated.string_308', 'lost items')}
                    </p>
                  </div>
                </div>

                <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/50 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">{t('generated.string_309', 'Active Found Reports')}</span>
                    <span className="p-2 rounded-xl bg-sky-50 text-primary">
                      <Search className="h-4 w-4" />
                    </span>
                  </div>
                  <div>
                    <div className="text-3xl font-extrabold text-on-surface tracking-tight font-sans">
                      {stats.found}
                    </div>
                    <p className="text-xs text-on-surface-variant mt-1 flex items-center gap-1">
                      <span className="font-semibold text-primary">{t('generated.string_310', 'Awaiting claim')}</span> {t('generated.string_311', 'validation')}
                    </p>
                  </div>
                </div>

                <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/50 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">{t('generated.string_312', 'Resolved Cases')}</span>
                    <span className="p-2 rounded-xl bg-[#9af4d6]/50 text-primary-dim">
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                  </div>
                  <div>
                    <div className="text-3xl font-extrabold text-on-surface tracking-tight font-sans">
                      {stats.claimed}
                    </div>
                    <p className="text-xs text-on-surface-variant mt-1 flex items-center gap-1">
                      <span className="font-semibold text-emerald-600">{t('profile.reunited')}</span> {t('generated.string_313', 'with rightful owners')}
                    </p>
                  </div>
                </div>

                <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/50 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">{t('generated.string_314', 'Success Rate')}</span>
                    <span className="p-2 rounded-xl bg-tertiary-container/10 text-tertiary-container">
                      <TrendingUp className="h-4 w-4" />
                    </span>
                  </div>
                  <div>
                    <div className="text-3xl font-extrabold text-on-surface tracking-tight font-sans">
                      {items.length > 0 ? Math.round((stats.claimed / items.length) * 100) : 0}%
                    </div>
                    <p className="text-xs text-on-surface-variant mt-1 flex items-center gap-1">
                      <span className="font-semibold text-amber-600">
                        {items.length > 0 && Math.round((stats.claimed / items.length) * 100) >= 50 ? t('analytics.highPerformance', 'High performance') : t('analytics.steadyGrowth', 'Steady growth')}
                      </span>{" "}
                      {t('generated.string_315', 'across')} {items.length} {t('generated.string_316', 'total reports')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Dynamic Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Chart 1: Recovery Trends (Col-span 2) */}
                <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/50 shadow-sm lg:col-span-2">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-on-surface text-sm tracking-tight font-sans uppercase">{t('generated.string_317', 'Recovery Trends')}</h3>
                      <p className="text-xs text-on-surface-variant">{t('generated.string_318', 'Monthly breakdown of reported vs resolved items')}</p>
                    </div>
                    {/* Legend */}
                    <div className="flex items-center gap-3 text-xs font-medium">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-[#9af4d6] rounded"></span>
                        <span className="text-on-surface-variant">{t('generated.string_319', 'Reported')}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-primary rounded"></span>
                        <span className="text-on-surface-variant">{t('search.resolved', 'Resolved')}</span>
                      </div>
                    </div>
                  </div>

                  {/* SVG Bar Chart */}
                  <div className="w-full h-64 flex flex-col mt-4">
                    <div className="flex-1 flex items-end gap-2 sm:gap-4 relative pt-6 border-b border-outline-variant/50 pb-2 h-48">
                      {/* Y-Axis Labels */}
                      <div className="absolute left-0 top-0 bottom-6 w-8 flex flex-col justify-between text-[10px] text-on-surface-variant font-medium select-none pointer-events-none">
                        <span>{maxChartValue}</span>
                        <span>{Math.round(maxChartValue * 0.75)}</span>
                        <span>{Math.round(maxChartValue * 0.5)}</span>
                        <span>{Math.round(maxChartValue * 0.25)}</span>
                        <span>0</span>
                      </div>

                      {/* Chart Bars Grid */}
                      <div className="flex-1 flex items-end justify-between ml-10 h-full relative">
                        {/* Horizontal Grid lines */}
                        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6">
                          <div className="w-full border-t border-surface-variant"></div>
                          <div className="w-full border-t border-surface-variant"></div>
                          <div className="w-full border-t border-surface-variant"></div>
                          <div className="w-full border-t border-surface-variant"></div>
                          <div className="w-full border-t border-surface-variant"></div>
                        </div>

                        {/* Month Bars */}
                        {monthlyStats.map((m, idx) => {
                          const reportedHeight = maxChartValue > 0 ? (m.reported / maxChartValue) * 80 : 0;
                          const resolvedHeight = maxChartValue > 0 ? (m.resolved / maxChartValue) * 80 : 0;

                          return (
                            <div key={idx} className="flex flex-col items-center gap-2 z-10 w-full group">
                              <div className="flex items-end justify-center gap-1 sm:gap-1.5 w-full h-40">
                                {/* Reported Bar */}
                                <div
                                  className="w-3 sm:w-5 bg-[#9af4d6] rounded-t-sm relative hover:bg-[#83ebd0] transition-all duration-300 shadow-sm"
                                  style={{ height: `${Math.max(reportedHeight, 2)}%` }}
                                >
                                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-on-surface text-white text-[10px] font-bold px-2 py-1 rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-20 whitespace-nowrap pointer-events-none">
                                    {t('generated.string_319', 'Reported')}: {m.reported}
                                  </div>
                                </div>
                                {/* Resolved Bar */}
                                <div
                                  className="w-3 sm:w-5 bg-primary rounded-t-sm relative hover:bg-primary-dim transition-all duration-300 shadow-sm"
                                  style={{ height: `${Math.max(resolvedHeight, 2)}%` }}
                                >
                                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-on-surface text-white text-[10px] font-bold px-2 py-1 rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-20 whitespace-nowrap pointer-events-none">
                                    {t('search.resolved', 'Resolved')}: {m.resolved}
                                  </div>
                                </div>
                              </div>
                              <span className="text-[10px] font-medium text-on-surface-variant">{m.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Chart 2: Categories (Col-span 1) */}
                <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/50 shadow-sm flex flex-col">
                  <div>
                    <h3 className="font-bold text-on-surface text-sm tracking-tight font-sans uppercase mb-1">{t('generated.string_321', 'Categories')}</h3>
                    <p className="text-xs text-on-surface-variant mb-4">{t('generated.string_322', 'Distribution by matched keywords')}</p>
                  </div>

                  {/* SVG Donut */}
                  <div className="flex-1 flex flex-col justify-center">
                    {(() => {
                      const activeCategories = categoryStats.filter((c) => c.count > 0);
                      if (activeCategories.length === 0) {
                        return (
                          <div className="flex flex-col items-center justify-center h-48 text-outline-variant">
                            <span className="text-4xl mb-2">📊</span>
                            <p className="text-xs text-on-surface-variant">{t('generated.string_323', 'No reported data yet')}</p>
                          </div>
                        );
                      }

                      const radius = 45;
                      const strokeWidth = 10;
                      const circumference = 2 * Math.PI * radius;
                      let accumulatedPercentage = 0;

                      return (
                        <div className="relative w-40 h-40 mx-auto mb-4">
                          <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                            <circle
                              cx="50"
                              cy="50"
                              r={radius}
                              fill="transparent"
                              stroke="#f3f4f6"
                              strokeWidth={strokeWidth}
                            />
                            {categoryStats.map((cat) => {
                              if (cat.count === 0) return null;
                              const strokeLength = (cat.percentage / 100) * circumference;
                              const strokeOffset = circumference - (accumulatedPercentage / 100) * circumference;
                              accumulatedPercentage += cat.percentage;

                              return (
                                <circle
                                  key={cat.name}
                                  cx="50"
                                  cy="50"
                                  r={radius}
                                  fill="transparent"
                                  stroke={cat.color}
                                  strokeWidth={strokeWidth}
                                  strokeDasharray={`${strokeLength} ${circumference}`}
                                  strokeDashoffset={strokeOffset}
                                  strokeLinecap="round"
                                  className="transition-all duration-300 hover:stroke-[12px] cursor-pointer"
                                />
                              );
                            })}
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-extrabold text-on-surface font-sans">{items.length}</span>
                            <span className="text-[9px] text-on-surface-variant font-bold uppercase tracking-wider">{t('generated.string_324', 'Reports')}</span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Scrollable category list legend */}
                    <div className="max-h-24 overflow-y-auto pr-1 flex flex-col gap-1 text-[11px]">
                      {categoryStats.map((cat) => {
                        if (cat.count === 0) return null;
                        return (
                          <div key={cat.name} className="flex items-center justify-between text-on-surface-variant">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }}></span>
                              <span className="truncate">{cat.name}</span>
                            </div>
                            <span className="font-semibold text-on-surface ml-1 shrink-0">{cat.percentage}% ({cat.count})</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Table: Top Performing Areas */}
              <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/50 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-on-surface text-sm tracking-tight font-sans uppercase">{t('generated.string_325', 'Top Performing Areas')}</h3>
                    <p className="text-xs text-on-surface-variant">{t('generated.string_326', 'Locations sorted by total database activity')}</p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#9af4d6]/50 text-primary-dim">
                    {t('generated.string_327', 'Live')}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-on-surface-variant border-collapse">
                    <thead>
                      <tr className="border-b border-outline-variant/50 text-[10px] text-on-surface-variant uppercase font-semibold">
                        <th className="py-2.5 pb-2">{t('generated.string_328', 'Area / Location')}</th>
                        <th className="py-2.5 pb-2 text-center">{t('generated.string_329', 'Total Reported')}</th>
                        <th className="py-2.5 pb-2 text-center">{t('generated.string_330', 'Recovered / Claimed')}</th>
                        <th className="py-2.5 pb-2 text-center">{t('generated.string_314', 'Success Rate')}</th>
                        <th className="py-2.5 pb-2 text-right">{t('generated.string_331', 'Trend')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {locationStats.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-on-surface-variant">
                            {t('generated.string_332', 'No locations reported yet. Submit items on the Report tab to populate statistics!')}
                          </td>
                        </tr>
                      ) : (
                        locationStats.map((loc, idx) => (
                          <tr key={idx} className="border-b border-surface-variant hover:bg-surface-container/50 transition-colors">
                            <td className="py-3 font-semibold text-on-surface flex items-center gap-2">
                              <MapPin className="h-3.5 w-3.5 text-on-surface-variant" />
                              {loc.name}
                            </td>
                            <td className="py-3 text-center text-on-surface-variant font-medium">{loc.total}</td>
                            <td className="py-3 text-center text-on-surface-variant font-medium">{loc.resolved}</td>
                            <td className="py-3 text-center">
                              <div className="inline-flex items-center gap-1.5 font-bold text-on-surface">
                                <div className="w-12 bg-surface-variant rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className="bg-primary h-full rounded-full"
                                    style={{ width: `${loc.rate}%` }}
                                  ></div>
                                </div>
                                <span>{loc.rate}%</span>
                              </div>
                            </td>
                            <td className="py-3 text-right">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${loc.trendColor}`}>
                                {loc.trendText}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* PANEL: GENERAL LIST OF INFORMATION GUIDES */}
            <section
              id="tips"
              className={`panel ${activeTab === "tips" ? "active" : ""}`}
            >
              <div className="section-title">
                <Navigation className="h-5 w-5 inline mr-1 text-primary" /> {t('generated.string_333', 'Lost Item Recovery Guide')}
              </div>
              <p className="section-subtitle">
                {t('generated.string_334', 'Helpful tips to increase your chances of finding lost items')}
              </p>
              <div className="tips-grid">
                <div className="tip-card">
                  <Search className="h-5 w-5 text-primary inline mr-1" />{" "}
                  <strong>{t('generated.string_335', 'Retrace Recent Locations')}</strong>
                  <br />
                  <br />
                  {t('generated.string_336', 'Carefully revisit the places you recently visited to help locate missing items.')}
                </div>
                <div className="tip-card">
                  <MapPin className="h-5 w-5 text-error inline mr-1" />{" "}
                  <strong>{t('generated.string_337', 'Check Nearby Areas')}</strong>
                  <br />
                  <br />
                  {t('generated.string_338', 'Inspect public spaces, offices, transportation stops, shops, and common areas.')}
                </div>
                <div className="tip-card">
                  <Smartphone className="h-5 w-5 text-primary-dim inline mr-1" />{" "}
                  <strong>{t('generated.string_339', 'Use Digital Tools')}</strong>
                  <br />
                  <br />
                  {t('generated.string_340', 'Post on forums, use FindTrack, check social media groups.')}
                </div>
                <div className="tip-card">
                  <CheckCircle2 className="h-5 w-5 text-primary inline mr-1" />{" "}
                  <strong>{t('generated.string_341', 'Act Quickly')}</strong>
                  <br />
                  <br />
                  {t('generated.string_342', 'Report and search within 2 hours for best results.')}
                </div>
                <div className="tip-card">
                  <Camera className="h-5 w-5 text-tertiary-container inline mr-1" />{" "}
                  <strong>{t('generated.string_343', 'Add Photos')}</strong>
                  <br />
                  <br />
                  {t('generated.string_344', 'Upload a photo of your item for much faster identification.')}
                </div>
                <div className="tip-card">
                  <Bell className="h-5 w-5 text-pink-500 inline mr-1" />{" "}
                  <strong>{t('generated.string_345', 'Stay Updated')}</strong>
                  <br />
                  <br />
                  {t('generated.string_346', 'Receive updates and notifications about matched or recovered items.')}
                </div>
                <div className="tip-card">
                  <PenTool className="h-5 w-5 text-on-surface-variant inline mr-1" />{" "}
                  <strong>{t('generated.string_347', 'Submit Detailed Reports')}</strong>
                  <br />
                  <br />
                  {t('generated.string_348', 'Provide accurate descriptions and item details for easier identification.')}
                </div>
              </div>
            </section>

            <section
              id="packaging"
              className={`panel ${activeTab === "packaging" ? "active" : ""}`}
            >
              <div className="section-title">
                <Package className="h-5 w-5 inline mr-1 text-primary" />{" "}
                {t('generated.string_349', 'Packaging & Handling Tips')}
              </div>
              <p className="section-subtitle">
                {t('generated.string_350', 'Best practices for securing found items')}
              </p>
              <div className="tips-grid">
                <div className="tip-card">
                  <ShieldCheck className="h-5 w-5 text-primary inline mr-1" />{" "}
                  <strong>{t('generated.string_351', 'Protect Fragile Items')}</strong>
                  <br />
                  <br />
                  {t('generated.string_352', 'Use bubble wrap or padding for delicate objects.')}
                </div>
                <div className="tip-card">
                  <Package className="h-5 w-5 text-secondary inline mr-1" />{" "}
                  <strong>{t('generated.string_353', 'Seal Securely')}</strong>
                  <br />
                  <br />
                  {t('generated.string_354', 'Ensure items are properly contained before storage.')}
                </div>
                <div className="tip-card">
                  <HomeIcon className="h-5 w-5 text-primary-dim inline mr-1" />{" "}
                  <strong>{t('generated.string_355', 'Classify Correctly')}</strong>
                  <br />
                  <br />
                  {t('generated.string_356', 'Hand keys and sensitive IDs straight to the Library security safe desk.')}
                </div>
                <div className="tip-card">
                  <CheckCircle2 className="h-5 w-5 text-primary inline mr-1" />{" "}
                  <strong>{t('generated.string_357', 'Update Status')}</strong>
                  <br />
                  <br />
                  {t('generated.string_358', "Mark items as claimed once they've been recovered.")}
                </div>
              </div>
            </section>

            
            {/* Settings */}
            <div className={`${activeTab === "settings" ? "block" : "hidden"} flex-1 flex flex-col min-w-0 h-full`}>
              <SettingsPage />
            </div>

            <section
              id="about"
              className={`${activeTab === "about" ? "block" : "hidden"}`}
            >
              <div className="max-w-6xl mx-auto space-y-8">
                <header className="mb-8">
                  <h2 className="font-headline-lg text-3xl font-bold text-on-surface">{t('sidebar.aboutHelp', 'About & Help')}</h2>
                  <p className="font-body-md text-on-surface-variant mt-2">{t('about.everythingYouNeedToKnow', 'Everything you need to know about FindTrack.')}</p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  <div className="lg:col-span-8 space-y-8">
                    {/* FAQ */}
                    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-6 md:p-8">
                      <h3 className="font-headline-md text-xl font-bold text-on-surface mb-6 flex items-center gap-2">
                        <Info className="h-6 w-6 text-primary" /> {t('about.faq', 'Frequently Asked Questions')}
                      </h3>
                      
                      <div className="space-y-6">
                        <div className="border-b border-outline-variant pb-6">
                          <h4 className="font-bold text-on-surface mb-2">{t('about.howVerify', 'How do I verify ownership?')}</h4>
                          <p className="text-on-surface-variant text-sm">{t('about.howVerifyDesc', 'When you claim a found item, you must correctly answer the security/security question set by the finder. Additionally, the finder may request further proof of ownership via contact before handing over the item.')}</p>
                        </div>
                        <div className="border-b border-outline-variant pb-6">
                          <h4 className="font-bold text-on-surface mb-2">{t('about.whatHappens', 'What happens when an item is claimed?')}</h4>
                          <p className="text-on-surface-variant text-sm">{t('about.whatHappensDesc', "Once an item is successfully claimed and verified, its status changes to 'Resolved'. Contact details are then shared securely between both parties to arrange the return.")}</p>
                        </div>
                        <div>
                          <h4 className="font-bold text-on-surface mb-2">{t('about.isFree', 'Is FindTrack free to use?')}</h4>
                          <p className="text-on-surface-variant text-sm">{t('about.isFreeDesc', 'Yes, FindTrack is completely free for all community members. Our mission is to restore trust and reunite lost items with their rightful owners.')}</p>
                        </div>
                      </div>
                    </div>

                    {/* Guidelines */}
                    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-6 md:p-8">
                      <h3 className="font-headline-md text-xl font-bold text-on-surface mb-6 flex items-center gap-2">
                        <ShieldCheck className="h-6 w-6 text-primary" /> {t('about.communityGuidelines', 'Community Guidelines')}
                      </h3>
                      <ul className="space-y-3 text-sm text-on-surface-variant">
                        <li className="flex gap-2"><CheckCircle2 className="h-5 w-5 text-primary shrink-0" /> {t('about.guideline1', 'Always meet in public, well-lit places when returning items.')}</li>
                        <li className="flex gap-2"><CheckCircle2 className="h-5 w-5 text-primary shrink-0" /> {t('about.guideline2', 'Do not share personal addresses or sensitive information until verified.')}</li>
                        <li className="flex gap-2"><CheckCircle2 className="h-5 w-5 text-primary shrink-0" /> {t('about.guideline3', 'Report any suspicious behavior or false claims immediately.')}</li>
                      </ul>
                    </div>
                  </div>

                  <div className="lg:col-span-4 space-y-6">
                    {/* Contact Support */}
                    <div className="bg-primary text-on-primary rounded-xl p-6 md:p-8 text-center relative overflow-hidden">
                      <div className="relative z-10">
                        <div className="w-16 h-16 bg-surface-container-lowest/20 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Mail className="h-8 w-8" />
                        </div>
                        <h3 className="font-headline-md text-xl font-bold mb-2">{t('about.needMoreHelp', 'Need More Help?')}</h3>
                        <p className="text-sm text-on-primary/90 mb-6">{t('about.needMoreHelpDesc', 'Our support team is ready to assist you with any issues or disputes.')}</p>
                        <a href="mailto:novapulsarsupport@gmail.com" className="inline-block w-full py-3 bg-surface-container-lowest text-primary font-bold rounded-xl hover:bg-surface-variant transition-colors shadow-sm">
                          {t('about.contactSupport', 'Contact Support')}
                        </a>
                      </div>
                      <div className="absolute -top-12 -right-12 w-32 h-32 bg-surface-container-lowest/10 rounded-full blur-2xl"></div>
                      <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-surface-container-lowest/10 rounded-full blur-2xl"></div>
                    </div>

                    {/* App Info */}
                    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-6 text-center">
                      <div className="w-12 h-12 bg-surface-variant rounded-xl flex items-center justify-center mx-auto mb-3">
                        <span className="text-xl">✨</span>
                      </div>
                      <h4 className="font-bold text-on-surface">FindTrack</h4>
                      <p className="text-xs text-on-surface-variant mt-1 mb-4">{t('about.version', 'Version 2.0.0 (Beta)')}</p>
                      <div className="flex justify-center gap-4 text-xs font-bold text-primary">
                        <button onClick={() => setCurrentView('privacy')}>{t('landing.privacyPolicy')}</button>
                        <span>&bull;</span>
                        <button onClick={() => setCurrentView('terms')}>{t('landing.termsOfService')}</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
</main>

          {/* MOBILE HUD BOTTOM NAV */}
          <nav className="fixed bottom-0 left-0 right-0 z-[199] bg-surface/95 backdrop-blur-md border-t border-outline-variant/30 flex justify-between items-center px-2 py-3 pb-[calc(16px+env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(1,114,90,0.06)] md:hidden" id="bottomNav">
            <button
              onClick={() => {
                setActiveTab("home");
                setCategoryKeywords(null);
              }}
              className={`flex-1 flex flex-col items-center justify-center gap-1.5 h-12 transition-all duration-200 active:scale-95 cursor-pointer relative ${
                activeTab === "home" ? "text-primary" : "text-on-surface-variant/70 hover:text-primary/80"
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all duration-200 ${activeTab === 'home' ? 'bg-primary-container text-primary shadow-sm' : ''}`}>
                <HomeIcon className="h-6 w-6" />
              </div>
              <span className="text-[11px] font-semibold tracking-wide font-dmsans">{t('sidebar.home')}</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("search");
                setCategoryKeywords(null);
              }}
              className={`flex-1 flex flex-col items-center justify-center gap-1.5 h-12 transition-all duration-200 active:scale-95 cursor-pointer relative ${
                activeTab === "search" ? "text-primary" : "text-on-surface-variant/70 hover:text-primary/80"
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all duration-200 ${activeTab === 'search' ? 'bg-primary-container text-primary shadow-sm' : ''}`}>
                <Search className="h-6 w-6" />
              </div>
              <span className="text-[11px] font-semibold tracking-wide font-dmsans">{t('sidebar.search')}</span>
            </button>

            {/* CENTRALLY INTEGRATED REPORT TAB */}
            <button
              onClick={() => {
                if (profileName === "Guest") {
                  setShowGuestModal(true);
                } else {
                  setActiveTab("report");
                }
              }}
              className={`flex-1 flex flex-col items-center justify-center gap-1.5 h-12 transition-all duration-200 active:scale-95 cursor-pointer relative ${
                activeTab === "report" ? "text-primary" : "text-on-surface-variant/70 hover:text-primary/80"
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all duration-200 ${activeTab === 'report' ? 'bg-primary-container text-primary shadow-sm' : 'bg-surface-container-high border border-outline-variant/30 text-on-surface-variant'}`}>
                <PlusCircle className="h-6 w-6" />
              </div>
              <span className="text-[11px] font-semibold tracking-wide font-dmsans">{t('sidebar.reportItem')}</span>
            </button>

            <button
              onClick={() => {
                if (profileName === "Guest") {
                  setShowGuestModal(true);
                } else {
                  setActiveTab("notifications");
                }
              }}
              className={`flex-1 flex flex-col items-center justify-center gap-1.5 h-12 transition-all duration-200 active:scale-95 cursor-pointer relative ${
                activeTab === "notifications" ? "text-primary" : "text-on-surface-variant/70 hover:text-primary/80"
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all duration-200 ${activeTab === 'notifications' ? 'bg-primary-container text-primary shadow-sm' : ''}`}>
                <Bell className="h-6 w-6" />
              </div>
              <span className="text-[11px] font-semibold tracking-wide font-dmsans">{t('sidebar.alerts')}</span>
            </button>

            <button
              onClick={() => {
                setActiveTab("profile");
              }}
              className={`flex-1 flex flex-col items-center justify-center gap-1.5 h-12 transition-all duration-200 active:scale-95 cursor-pointer relative ${
                activeTab === "profile" ? "text-primary" : "text-on-surface-variant/70 hover:text-primary/80"
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all duration-200 ${activeTab === 'profile' ? 'bg-primary-container text-primary shadow-sm' : ''}`}>
                <UserIcon className="h-6 w-6" />
              </div>
              <span className="text-[11px] font-semibold tracking-wide font-dmsans">{t('sidebar.profile')}</span>
            </button>
          </nav>
          </div>
        </div>
      )}

      {/* ── ONBOARDING LIGHT OVERLAY DRAWER ── */}
      {showOnboarding && (
        <div className="onboard-overlay">
          <div className="onboard-card" id="onboardCard">
            <div className="onboard-progress" id="onboardProgress">
              {ONBOARD_STEPS.map((_, idx) => (
                <div
                  key={idx}
                  className={`onboard-pip ${idx < onboardStep ? "done" : idx === onboardStep ? "active" : ""}`}
                ></div>
              ))}
            </div>

            <div className="onboard-visual">
              <div className="onboard-icon-wrap" id="onboardIcon">
                {ONBOARD_STEPS[onboardStep].icon}
              </div>
            </div>

            <div className="onboard-body">
              <div className="onboard-step-label" id="onboardLabel">
                {ONBOARD_STEPS[onboardStep].label}
              </div>
              <div className="onboard-title" id="onboardTitle">
                {ONBOARD_STEPS[onboardStep].title}
              </div>
              <div className="onboard-desc" id="onboardDesc">
                {ONBOARD_STEPS[onboardStep].desc}
              </div>

              <div className="onboard-actions">
                <button
                  onClick={() => {
                    if (onboardStep < ONBOARD_STEPS.length - 1) {
                      setOnboardStep((prev) => prev + 1);
                    } else {
                      setShowOnboarding(false);
                      localStorage.setItem("ft_onboarded", "1");
                    }
                  }}
                  className="onboard-next"
                  id="onboardNext"
                >
                  {onboardStep === ONBOARD_STEPS.length - 1
                    ? "Get Started 🚀"
                    : "Next →"}
                </button>
                <button
                  onClick={() => {
                    setShowOnboarding(false);
                    localStorage.setItem("ft_onboarded", "1");
                  }}
                  className="onboard-skip"
                  id="onboardSkip"
                >
                  Skip tour
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── IMAGE ZOOM SYSTEM MODAL ── */}
      {zoomImg && (
        <div className="zoom-overlay" onClick={() => setZoomImg(null)}>
          <button className="zoom-close" onClick={() => setZoomImg(null)}>
            ✕
          </button>
          <img src={zoomImg} className="zoom-img" alt="Zoom view" />
          <div className="zoom-hint">Tap anywhere to close</div>
        </div>
      )}

      {/* ── GUEST ACCESS LOCK LOGIN REQUIRED MODAL ── */}
      {showGuestModal && (
        <div 
          id="guestModalOverlay" 
          className="fixed inset-0 z-[1002] flex items-center justify-center p-4 bg-surface/60 backdrop-blur-md overflow-y-auto" 
          onClick={(e) => {
            if ((e.target as HTMLElement).id === "guestModalOverlay")
              setShowGuestModal(false);
          }}
        >
          <div className="relative z-10 w-full max-w-md bg-surface-container-lowest rounded-[24px] shadow-lg shadow-primary/5 flex flex-col items-center p-8 text-center border border-surface-variant overflow-hidden">
            {/* Decorative Top Gradient (Subtle) */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-container via-primary to-primary-container opacity-30"></div>
            
            {/* Icon Container */}
            <div className="w-20 h-20 rounded-full bg-tertiary-container flex items-center justify-center mb-lg shadow-sm">
              <Lock className="h-10 w-10 text-on-tertiary-container" strokeWidth={1.5} />
            </div>
            
            {/* Headlines & Text */}
            <h2 className="font-headline-md text-headline-md text-on-surface mb-sm tracking-tight">Login Required</h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant mb-xl px-4 md:px-2 max-w-72 md:max-w-none">
              Please login or sign up to unlock the full features of FindTrack!
            </p>
            
            {/* Actions */}
            <div className="w-full flex flex-col gap-sm mb-lg">
              <button 
                onClick={() => {
                  setShowGuestModal(false);
                  setCurrentView("login");
                }}
                className="w-full bg-primary text-on-primary font-label-md text-label-md py-3 px-6 rounded-xl shadow-md hover:bg-primary-dim transition-all duration-200 flex items-center justify-center gap-2"
              >
                <LogIn className="h-4.5 w-4.5" strokeWidth={2} />{t('landing.login')}</button>
              <button 
                onClick={() => {
                  setShowGuestModal(false);
                  setCurrentView("signup");
                }}
                className="w-full bg-transparent text-secondary border border-secondary font-label-md text-label-md py-3 px-6 rounded-xl hover:bg-surface-variant transition-all duration-200 flex items-center justify-center gap-2"
              >
                <UserPlus className="h-4.5 w-4.5" strokeWidth={2} />
                Sign Up
              </button>
            </div>
            
            {/* Subtle Link */}
            <button 
              onClick={() => setShowGuestModal(false)}
              className="font-label-md text-label-md text-on-surface-variant hover:text-primary underline decoration-on-surface-variant/30 underline-offset-4 transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      )}


      {/* ── REAL-TIME DIRECT MESSAGING DRAWER OVERLAY ── */}
      {activeChatId && (
        <ChatInterface
          activeChatId={activeChatId}
          currentUserUid={user ? user.uid : null}
          onClose={() => setActiveChatId(null)}
          onSelectChat={(id) => setActiveChatId(id)}
        />
      )}
    </div>
  );
}

// Cognitive calculation helper utility for similarity matching metrics
function computeMatchScore(a: any, b: any) {
  if (a.type === b.type) return 0;
  if (a.claimed || b.claimed) return 0;

  const textA =
    `${a?.title || ""} ${a?.desc || a?.description || ""} ${a?.location || ""}`.toLowerCase();
  const textB =
    `${b?.title || ""} ${b?.desc || b?.description || ""} ${b?.location || ""}`.toLowerCase();

  const stopWords = new Set([
    "a",
    "an",
    "the",
    "my",
    "i",
    "is",
    "at",
    "in",
    "on",
    "of",
    "and",
    "or",
    "was",
    "it",
    "this",
    "that",
    "with",
    "for",
    "to",
  ]);
  const tokenise = (t: string) =>
    t
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));

  const tA = new Set(tokenise(textA));
  const tB = new Set(tokenise(textB));
  if (tA.size === 0 || tB.size === 0) return 0;

  let shared = 0;
  tA.forEach((w) => {
    if (tB.has(w)) shared++;
  });

  // Jaccard similarity
  const union = new Set([...Array.from(tA), ...Array.from(tB)]).size;
  const jaccard = shared / union;

  // Location bonus
  const locA = (a.location || "").toLowerCase();
  const locB = (b.location || "").toLowerCase();
  const locBonus =
    locA &&
    locB &&
    (locA.includes(locB.slice(0, 5)) || locB.includes(locA.slice(0, 5)))
      ? 0.15
      : 0;

  return Math.min(1, jaccard + locBonus);
}
