import {
  ArrowRightStartOnRectangleIcon,
  Cog6ToothIcon,
  UserCircleIcon as UserCircleIconOutline,
} from "@heroicons/react/24/outline";
import { UserCircleIcon as UserCircleIconSolid } from "@heroicons/react/24/solid";
import {
  ControlPlaneSessionInfo,
  isHubSession,
  isOnPremSession,
  isShihuoSession,
} from "core/control-plane/AuthTypes";
import { useContext } from "react";
import { ToolTip } from "../../../../components/gui/Tooltip";
import {
  Avatar,
  Button,
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "../../../../components/ui";
import { Divider } from "../../../../components/ui/Divider";
import { useAuth } from "../../../../context/Auth";
import { IdeMessengerContext } from "../../../../context/IdeMessenger";

// Helper function to get avatar fallback text
function getAvatarFallback(
  session: ControlPlaneSessionInfo | undefined,
): string {
  if (!session) return "?";

  if (isShihuoSession(session)) {
    // For Shihuo sessions, use first letter of the label
    return session.account.label.charAt(0).toUpperCase();
  }

  if (isHubSession(session)) {
    // For Hub sessions, use first letter of the label
    return session.account.label.charAt(0).toUpperCase();
  }

  return "?";
}

export function AccountDropdown() {
  const {
    session,
    multiSession,
    logoutContinue,
    logoutShihuo,
    login,
    loginWithShihuo,
  } = useAuth();
  const ideMessenger = useContext(IdeMessengerContext);

  if (isOnPremSession(session)) {
    return null;
  }

  // Show login buttons if no sessions exist
  if (!multiSession.continueSession && !multiSession.shihuoSession) {
    return (
      <div className="flex flex-col gap-1">
        <ToolTip content="Log in with Continue" className="text-xs md:!hidden">
          <Button
            variant="ghost"
            className="text-description flex w-full flex-row items-center gap-2 px-2 py-1.5"
            onClick={() => login(false)}
          >
            <UserCircleIconOutline className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0" />
            <span className="text-description hidden text-left text-xs md:block">
              Login with Continue
            </span>
          </Button>
        </ToolTip>
        <ToolTip content="Log in with Shihuo" className="text-xs md:!hidden">
          <Button
            variant="ghost"
            className="text-description flex w-full flex-row items-center gap-2 px-2 py-1.5"
            onClick={() => loginWithShihuo()}
          >
            <UserCircleIconOutline className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0" />
            <span className="text-description hidden text-left text-xs md:block">
              Login with Shihuo
            </span>
          </Button>
        </ToolTip>
      </div>
    );
  }

  return (
    <div>
      <Listbox>
        {({ open }) => (
          <>
            <ListboxButton
              className={`text-description w-full justify-start gap-1 border-none p-0 md:px-2 md:py-1.5 ${
                open ? "bg-input" : "hover:bg-input bg-inherit"
              }`}
            >
              {multiSession.shihuoSession &&
              isShihuoSession(multiSession.shihuoSession) &&
              multiSession.shihuoSession.account.avatar ? (
                <Avatar
                  src={multiSession.shihuoSession.account.avatar}
                  alt={multiSession.shihuoSession.account.label}
                  fallback={getAvatarFallback(multiSession.shihuoSession)}
                  size="sm"
                  className="ml-1 flex-shrink-0 md:ml-0"
                />
              ) : (
                <UserCircleIconSolid className="xs:h-4 xs:w-4 h-3 w-3 flex-shrink-0" />
              )}
              <div className="ml-1 flex min-w-0 flex-1 flex-col items-start overflow-hidden">
                <span className="w-full truncate text-xs font-medium hover:brightness-110">
                  {multiSession.shihuoSession &&
                  isShihuoSession(multiSession.shihuoSession)
                    ? multiSession.shihuoSession.account.label
                    : "No Shihuo Account"}
                </span>
                <span className="text-description-muted w-full truncate text-xs">
                  {multiSession.shihuoSession &&
                  isShihuoSession(multiSession.shihuoSession)
                    ? multiSession.shihuoSession.account.id
                    : "Sign in to Shihuo"}
                </span>
              </div>
            </ListboxButton>
            <ListboxOptions anchor="right end">
              {multiSession.continueSession &&
                isHubSession(multiSession.continueSession) && (
                  <div className="px-2 py-1">
                    <div className="flex items-center gap-2 py-0.5">
                      <UserCircleIconSolid className="h-6 w-6" />
                      <div className="flex flex-col">
                        <span className="text-xs font-medium">
                          Continue Account
                        </span>
                        <span className="text-description-muted text-xs">
                          {multiSession.continueSession.account.label}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

              {/* Add login options if not all accounts are logged in */}
              {!multiSession.continueSession && (
                <ListboxOption
                  onClick={() => login(false)}
                  value="login-continue"
                >
                  <div className="flex items-center gap-2 py-0.5">
                    <UserCircleIconOutline className="h-3.5 w-3.5" />
                    <span>Login with Continue</span>
                  </div>
                </ListboxOption>
              )}

              {!multiSession.shihuoSession && (
                <ListboxOption
                  onClick={() => loginWithShihuo()}
                  value="login-shihuo"
                >
                  <div className="flex items-center gap-2 py-0.5">
                    <UserCircleIconOutline className="h-3.5 w-3.5" />
                    <span>Login with Shihuo</span>
                  </div>
                </ListboxOption>
              )}

              <Divider />

              {/* Account management */}
              {session && (
                <ListboxOption
                  onClick={() =>
                    ideMessenger.post(
                      "openUrl",
                      "https://hub.continue.dev/settings",
                    )
                  }
                  value="manage-account"
                >
                  <div className="flex items-center gap-2 py-0.5">
                    <Cog6ToothIcon className="h-3.5 w-3.5" />
                    <span>Manage Account</span>
                  </div>
                </ListboxOption>
              )}

              {/* Logout options */}
              {multiSession.continueSession && (
                <ListboxOption onClick={logoutContinue} value="logout-continue">
                  <div className="flex items-center gap-2 py-0.5">
                    <ArrowRightStartOnRectangleIcon className="h-3.5 w-3.5" />
                    <span>Logout Continue</span>
                  </div>
                </ListboxOption>
              )}

              {multiSession.shihuoSession && (
                <ListboxOption onClick={logoutShihuo} value="logout-shihuo">
                  <div className="flex items-center gap-2 py-0.5">
                    <ArrowRightStartOnRectangleIcon className="h-3.5 w-3.5" />
                    <span>Logout Shihuo</span>
                  </div>
                </ListboxOption>
              )}
            </ListboxOptions>
          </>
        )}
      </Listbox>
    </div>
  );
}
