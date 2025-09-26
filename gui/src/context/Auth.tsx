import {
  ProfileDescription,
  SerializedOrgWithProfiles,
} from "core/config/ProfileLifecycleManager";
import {
  AuthType,
  ControlPlaneSessionInfo,
  getActiveSession,
  MultiSessionInfo,
} from "core/control-plane/AuthTypes";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useWebviewListener } from "../hooks/useWebviewListener";
import { useAppDispatch, useAppSelector } from "../redux/hooks";
import { setConfigLoading } from "../redux/slices/configSlice";
import {
  selectCurrentOrg,
  selectSelectedProfile,
  setOrganizations,
  setSelectedOrgId,
} from "../redux/slices/profilesSlice";
import { IdeMessengerContext } from "./IdeMessenger";

interface AuthContextType {
  session: ControlPlaneSessionInfo | undefined;
  multiSession: MultiSessionInfo;
  logout: () => void;
  logoutContinue: () => void;
  logoutShihuo: () => void;
  login: (useOnboarding: boolean) => Promise<boolean>;
  loginWithShihuo: () => Promise<boolean>;
  selectedProfile: ProfileDescription | null;
  profiles: ProfileDescription[] | null;
  refreshProfiles: (reason?: string) => Promise<void>;
  organizations: SerializedOrgWithProfiles[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const [multiSession, setMultiSession] = useState<MultiSessionInfo>({
    continueSession: undefined,
    shihuoSession: undefined,
  });

  const session = getActiveSession(multiSession);

  const orgs = useAppSelector((store) => store.profiles.organizations);

  const currentOrg = useAppSelector(selectCurrentOrg);
  const selectedProfile = useAppSelector(selectSelectedProfile);

  const login: AuthContextType["login"] = async (useOnboarding: boolean) => {
    try {
      const result = await ideMessenger.request("getControlPlaneSessionInfo", {
        silent: false,
        useOnboarding,
      });

      if (result.status === "error") {
        console.error("Login failed:", result.error);
        return false;
      }

      const continueSession = result.content;
      setMultiSession((prev) => ({
        ...prev,
        continueSession,
      }));

      return true;
    } catch (error: any) {
      console.error("Login request failed:", error);
      // Let the error propagate so the caller can handle it
      throw error;
    }
  };

  const loginWithShihuo: AuthContextType["loginWithShihuo"] = () => {
    return new Promise(async (resolve) => {
      await ideMessenger
        .request("getShihuoSessionInfo", {
          silent: false,
        })
        .then((result) => {
          if (result.status === "error") {
            resolve(false);
            return;
          }

          const shihuoSession = result.content;
          setMultiSession((prev) => ({
            ...prev,
            shihuoSession,
          }));

          resolve(true);
        });
    });
  };

  const logout = () => {
    // Logout from both sessions
    ideMessenger.post("logoutOfControlPlane", undefined);
    ideMessenger.post("logoutOfShihuo", undefined);
    dispatch(setOrganizations(orgs.filter((org) => org.id === "personal")));
    dispatch(setSelectedOrgId("personal"));
    setMultiSession({
      continueSession: undefined,
      shihuoSession: undefined,
    });
  };

  const logoutContinue = () => {
    ideMessenger.post("logoutOfControlPlane", undefined);
    setMultiSession((prev) => ({
      ...prev,
      continueSession: undefined,
    }));
  };

  const logoutShihuo = () => {
    ideMessenger.post("logoutOfShihuo", undefined);
    setMultiSession((prev) => ({
      ...prev,
      shihuoSession: undefined,
    }));
  };

  useEffect(() => {
    async function init() {
      // Initialize both sessions
      const [continueResult, shihuoResult] = await Promise.all([
        ideMessenger.request("getControlPlaneSessionInfo", {
          silent: true,
          useOnboarding: false,
        }),
        ideMessenger.request("getShihuoSessionInfo", {
          silent: true,
        }),
      ]);

      const continueSession =
        continueResult.status === "success"
          ? continueResult.content
          : undefined;
      const shihuoSession =
        shihuoResult.status === "success" ? shihuoResult.content : undefined;

      setMultiSession({
        continueSession,
        shihuoSession,
      });
    }
    void init();
  }, []);

  useWebviewListener(
    "sessionUpdate",
    async (data) => {
      const sessionInfo = data.sessionInfo;
      if (sessionInfo) {
        if (sessionInfo.AUTH_TYPE === AuthType.ShihuoSSO) {
          setMultiSession((prev) => ({
            ...prev,
            shihuoSession: sessionInfo,
          }));
        } else if (
          sessionInfo.AUTH_TYPE === AuthType.WorkOsProd ||
          sessionInfo.AUTH_TYPE === AuthType.WorkOsStaging
        ) {
          setMultiSession((prev) => ({
            ...prev,
            continueSession: sessionInfo,
          }));
        }
      }
    },
    [],
  );

  const refreshProfiles = useCallback(
    async (reason?: string) => {
      try {
        dispatch(setConfigLoading(true));
        await ideMessenger.request("config/refreshProfiles", {
          reason,
        });
        ideMessenger.post("showToast", ["info", "Config refreshed"]);
      } catch (e) {
        console.error("Failed to refresh profiles", e);
        ideMessenger.post("showToast", ["error", "Failed to refresh config"]);
      } finally {
        dispatch(setConfigLoading(false));
      }
    },
    [ideMessenger],
  );

  return (
    <AuthContext.Provider
      value={{
        session,
        multiSession,
        logout,
        logoutContinue,
        logoutShihuo,
        login,
        loginWithShihuo,
        selectedProfile,
        profiles: currentOrg?.profiles ?? [],
        refreshProfiles,
        organizations: orgs,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
