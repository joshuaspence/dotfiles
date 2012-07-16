import XMonad.Config.Gnome -- for gnomeConfig
import XMonad.Layout.Grid
import XMonad.Layout.ResizableTile
import XMonad.Layout.IM
import XMonad.Layout.ThreeColumns
import XMonad.Layout.NoBorders
import XMonad.Layout.Circle
import XMonad.Layout.PerWorkspace (onWorkspace)
import XMonad.Layout.Fullscreen
import XMonad.Util.EZConfig
import XMonad.Util.Run
import XMonad.Hooks.DynamicLog
import XMonad.Actions.Plane
import XMonad.Hooks.ManageDocks
import XMonad.Hooks.ManageHelpers -- for isFullScreen, doFullFloat
import XMonad.Hooks.UrgencyHook
import qualified XMonad.StackSet as W
import qualified Data.Map as M
import Data.Ratio ((%))

import System.IO
import System.Exit
import XMonad
import XMonad.Hooks.DynamicLog
import XMonad.Hooks.ManageDocks
import XMonad.Hooks.ManageHelpers
import XMonad.Hooks.SetWMName
import XMonad.Layout.NoBorders
import XMonad.Layout.Spiral
import XMonad.Layout.Tabbed
import XMonad.Util.Run(spawnPipe)
import XMonad.Util.EZConfig(additionalKeys)
import XMonad.Hooks.UrgencyHook
import XMonad.Util.Dzen
import XMonad.Hooks.ICCCMFocus
import qualified XMonad.StackSet as W
import qualified Data.Map        as M


{-------------------------------------------------------------------------------
	Xmonad configuration variables. These settings control some of the simpler
	parts of xmonad's behavior and are straightforward to tweak.
-------------------------------------------------------------------------------}
myBaseConfig         = gnomeConfig      -- defaults on which we build
myFocusedBorderColor = "#ff0000"        -- color of focused border
myNormalBorderColor  = "#cccccc"        -- color of inactive border
myBorderWidth        = 1                -- width of border around windows
-- Colors for text and backgrounds of each tab when in "Tabbed" layout.
tabConfig = defaultTheme {
    activeBorderColor   = "#ee9a00", 
    activeTextColor     = "#657b83",
    activeColor         = "#002b36",
    inactiveBorderColor = "#657b83",
    inactiveTextColor   = "#657b83",
    inactiveColor       = "#002b36"
}
myTerminal           = "gnome-terminal" -- which terminal software to use
myIMRosterTitle      = "Contact List"   -- title of roster on IM workspace


{-------------------------------------------------------------------------------
    Key bindings.
    
    modMask lets you specify which modkey you want to use. The default is
    mod1Mask ("left alt").  You may also consider using mod3Mask ("right alt"), 
    which does not conflict with emacs keybindings. The "windows key" is usually
    mod4Mask.
-------------------------------------------------------------------------------}
myModMask = mod4Mask


{-------------------------------------------------------------------------------
    The mask for the numlock key. Numlock status is "masked" from the current 
    modifier status, so the keybindings will work with numlock on or off. You 
    may need to change this on some systems.
    
    You can find the numlock modifier by running "xmodmap" and looking for a
    modifier with Num_Lock bound to it:
        > $ xmodmap | grep Num
        > mod2        Num_Lock (0x4d)
    
    Set numlockMask = 0 if you don't have a numlock key, or want to treat 
    numlock status separately.
-------------------------------------------------------------------------------}
myNumlockMask = 0


{-------------------------------------------------------------------------------
	Xmobar configuration variables. These settings control the appearance of
	text which xmonad is sending to xmobar via the DynamicLog hook.
-------------------------------------------------------------------------------}
xmobarTitleColor            = "#eeeeee"  -- color of window title
xmobarCurrentWorkspaceColor = "#e6744c"  -- color of active workspace


{-------------------------------------------------------------------------------
	Workspace configuration. Here you can change the names of your workspaces. 
	Note that they are organized in a grid corresponding to the layout of the 
	number pad.

	I would recommend sticking with relatively brief workspace names because 
	they are displayed in the xmobar status bar, where space can get tight. 
	Also, the workspace labels are referred to elsewhere in the configuration 
	file, so when you change a label you will have to find places which refer to
	it and make a change there as well.

	This central organizational concept of this configuration is that the 
	workspaces correspond to keys on the number pad, and that they are organized
	in a grid which also matches the layout of the number pad. So, I don't 
	recommend changing the number of workspaces unless you are prepared to delve
	into the workspace navigation keybindings section as well.
-}

myWorkspaces = [
	"7:Chat",  "8:Dbg", "9:Pix",
    "4:Docs",  "5:Dev", "6:Web",
    "1:Term",  "2:Hub", "3:Mail",
    "0:VM",    "Extr1", "Extr2"
	]

startupWorkspace = "5:Dev"  -- which workspace do you want to be on after launch?


{-------------------------------------------------------------------------------
	Layout configuration. In this section we identify which xmonad layouts we 
	want to use. I have defined a list of default layouts which are applied on 
	every workspace, as well as special layouts which get applied to specific workspaces.

	Note that all layouts are wrapped within "avoidStruts". What this does is
	make the layouts avoid the status bar area at the top of the screen. Without
	this, they would overlap the bar. You can toggle this behavior by hitting
	"super-b" (bound to ToggleStruts in the keyboard bindings in the next 
	section).
	
	Note that each layout is separated by |||, which denotes layout choice.
-------------------------------------------------------------------------------}

-- Define group of default layouts used on most screens, in the order they will 
-- appear.
--     "smartBorders" modifier makes it so the borders on windows only appear if
-- 		    there is more than one visible window.
--     "avoidStruts" modifier makes it so that the layout provides space for the
--         status bar at the top of the screen.
myLayouts = smartBorders(avoidStruts(
	-- ResizableTall layout has a large master window on the left, and remaining
	-- windows tile on the right. By default each area takes up half the screen,
	-- but you can resize using "super-h" and "super-l".
	ResizableTall 1 (3/100) (1/2) []

	-- Mirrored variation of ResizableTall. In this layout, the large master 
	-- window is at the top, and remaining windows tile at the bottom of the 
	-- screen. Can be resized as described above.
	||| Mirror (ResizableTall 1 (3/100) (1/2) [])

	-- Full layout makes every window full screen. When you toggle the active 
	-- window, it will bring the active window to the front.
	||| noBorders Full

	-- Grid layout tries to equally distribute windows in the available space,
	-- increasing the number of columns and rows as necessary. Master window is 
	-- at top left.
	||| Grid

	-- ThreeColMid layout puts the large master window in the center of the 
	-- screen. As configured below, by default it takes of 3/4 of the available
	-- space. Remaining windows tile to both the left and right of the master 
	-- window. You can resize using "super-h" and "super-l".
	||| ThreeColMid 1 (3/100) (3/4)

	-- Circle layout places the master window in the center of the screen.
	-- Remaining windows appear in a circle around it.
	||| Circle))

-- Here we define some layouts which will be assigned to specific workspaces 
-- based on the functionality of that workspace.

-- The chat layout uses the "IM" layout. We have a roster which takes up 1/8 of 
-- the screen vertically, and the remaining space contains chat windows which 
-- are tiled using the grid layout. The roster is identified using the 
-- myIMRosterTitle variable, and by default is configured for Empathy, so if 
-- you're using something else you will want to modify that variable.
chatLayout = avoidStruts(withIM (1%7) (Title myIMRosterTitle) Grid)

-- The GIMP layout uses the ThreeColMid layout. The traditional GIMP floating 
-- panels approach is a bit of a challenge to handle with xmonad; I find the 
-- best solution is to make the image you are working on the master area, and 
-- then use this ThreeColMid layout to make the panels tile to the left and 
-- right of the image. If you use GIMP 2.8, you can use single-window mode and 
-- avoid this issue.
gimpLayout = smartBorders(avoidStruts(ThreeColMid 1 (3/100) (3/4)))

-- Here we combine our default layouts with our specific, workspace-locked
-- layouts.
myWorkspaceLayouts =
  onWorkspace "7:Chat" chatLayout
  $ onWorkspace "9:Pix" gimpLayout
  $ myLayouts


{-------------------------------------------------------------------------------
	Custom keybindings. In this section we define a list of relatively
	straightforward keybindings. This would be the clearest place to add your 
	own keybindings, or change the keys we have defined for certain functions.

	It can be difficult to find a good list of keycodes for use in xmonad. I 
	have found this page useful -- just look for entries beginning with "xK":

	http://xmonad.org/xmonad-docs/xmonad/doc-index-X.html

	Note that in the example below, the last three entries refer to nonstandard 
	keys which do not have names assigned by xmonad. That's because they are the
	volume and mute keys on my laptop, a Lenovo W520.

	If you have special keys on your keyboard which you want to bind to specific
	actions, you can use the "xev" command-line tool to determine the code for a
	specific key. Launch the command, then type the key in question and watch
	the output.
-------------------------------------------------------------------------------}

myKeys conf@(XConfig {XMonad.modMask = modMask}) = M.fromList $ [
    -- Start a terminal.  Terminal to start is specified by myTerminal variable.
    ((modMask .|. shiftMask, xK_Return),            spawn $ XMonad.terminal conf),
    
    -- Launch dmenu
    -- Use this to launch programs without a key binding.
    ((modMask, xK_p),                               spawn "dmenu_run -nb '#002b36' -nf '#657b83'"),
    
    -- Launch the Google Chrome browser
    ((modMask .|. shiftMask, xK_w),                 spawn "google-chrome"),
    
    -- Take a screenshot in window mode.
    ((modMask .|. shiftMask, xK_p),                 spawn "gnome-screenshot --window"),

    -- Take full screenshot in multi-head mode.
    ((modMask .|. controlMask .|. shiftMask, xK_p), spawn "gnome-screenshot"),

    -- Mute volume.
    ((0, 0x1008FF12),                               spawn "amixer -q set Master toggle"),

    -- Decrease volume and beep.
    ((0, 0x1008FF11),                               spawn "amixer -q set Master 5%- && aplay /usr/share/pommed/click.wav"),

    -- Increase volume and beep.
    ((0, 0x1008FF13),                               spawn "amixer -q set Master 5%+ && aplay /usr/share/pommed/click.wav"),

    -- Audio previous.
    ((0, 0x1008FF16),                               spawn ""),

    -- Play/pause.
    ((0, 0x1008FF14),                               spawn ""),

    -- Audio next.
    ((0, 0x1008FF17),                               spawn ""),

    -- Eject CD tray.
    ((0, 0x1008FF2C),                               spawn "eject -T"),
    
    --------------------------------------------------------------------
    -- "Standard" xmonad key bindings
    --------------------------------------------------------------------

    -- Close focused window.
    ((modMask .|. shiftMask, xK_c),         kill),

    -- Cycle through the available layout algorithms.
    ((modMask, xK_space),                   sendMessage NextLayout),

    --  Reset the layouts on the current workspace to default.
    ((modMask .|. shiftMask, xK_space),     setLayout $ XMonad.layoutHook conf),

    -- Resize viewed windows to the correct size.
    ((modMask, xK_n),                       refresh),

    -- Move focus to the next window.
    ((modMask, xK_Tab),                     windows W.focusDown),

    -- Move focus to the next window.
    ((modMask, xK_j),                       windows W.focusDown),

    -- Move focus to the previous window.
    ((modMask, xK_k),                       windows W.focusUp),

    -- Move focus to the master window.
    ((modMask, xK_m),                       windows W.focusMaster),

    -- Swap the focused window and the master window.
    ((modMask, xK_Return),                  windows W.swapMaster),

    -- Swap the focused window with the next window.
    ((modMask .|. shiftMask, xK_j),         windows W.swapDown),

    -- Swap the focused window with the previous window.
    ((modMask .|. shiftMask, xK_k),         windows W.swapUp),

    -- Shrink the master area.
    ((modMask, xK_h),                       sendMessage Shrink),

    -- Expand the master area.
    ((modMask, xK_l),                       sendMessage Expand),

    -- Push window back into tiling.
    ((modMask, xK_t),                       withFocused $ windows . W.sink),

    -- Increment the number of windows in the master area.
    ((modMask, xK_comma),                   sendMessage (IncMasterN 1)),

    -- Decrement the number of windows in the master area.
    ((modMask, xK_period),                  sendMessage (IncMasterN (-1))),

    -- Toggle the status bar gap.
    -- TODO: update this binding with avoidStruts, ((modMask, xK_b),

    -- Quit xmonad.
    ((modMask .|. shiftMask, xK_q),         io (exitWith ExitSuccess)),

    -- Restart xmonad.
    ((modMask, xK_q),                       restart "xmonad" True)
    ]
    
    ++
    -- mod-[1..9], Switch to workspace N
    -- mod-shift-[1..9], Move client to workspace N
    [((m .|. modMask, k), windows $ f i)
    | (i, k) <- zip (XMonad.workspaces conf) [xK_1 .. xK_9]
    , (f, m) <- [(W.greedyView, 0), (W.shift, shiftMask)]]
    
    ++
    -- mod-{w,e,r}, Switch to physical/Xinerama screens 1, 2, or 3
    -- mod-shift-{w,e,r}, Move client to screen 1, 2, or 3
    [((m .|. modMask, key), screenWorkspace sc >>= flip whenJust (windows . f))
    | (key, sc) <- zip [xK_w, xK_e, xK_r] [0..]
    , (f, m) <- [(W.view, 0), (W.shift, shiftMask)]]
    

{-------------------------------------------------------------------------------
    Mouse bindings
    
    Focus rules. True if your focus should follow your mouse cursor.
-------------------------------------------------------------------------------}
myFocusFollowsMouse :: Bool
myFocusFollowsMouse = True

myMouseBindings (XConfig {XMonad.modMask = modMask}) = M.fromList $ [
    -- mod-button1, Set the window to floating mode and move by dragging
    ((modMask, button1),                    (\w -> focus w >> mouseMoveWindow w)),

    -- mod-button2, Raise the window to the top of the stack
    ((modMask, button2),                    (\w -> focus w >> windows W.swapMaster)),

    -- mod-button3, Set the window to floating mode and resize by dragging
    ((modMask, button3),                    (\w -> focus w >> mouseResizeWindow w))

    -- you may also bind events to the mouse scroll wheel (button4 and button5)
    ]


{-------------------------------------------------------------------------------
    Status bars and logging
    
    Perform an arbitrary action on each internal state change or X event. See 
    the 'DynamicLog' extension for examples.

    To emulate dwm's status bar
        > logHook = dynamicLogDzen
-------------------------------------------------------------------------------}


{-------------------------------------------------------------------------------
    Startup hook
    
    Perform an arbitrary action each time xmonad starts or is restarted with 
    mod-q.  Used by, e.g., XMonad.Layout.PerWorkspace to initialize 
    per-workspace layout choices.
    
    By default, do nothing. (myStartUpHook = return())
-------------------------------------------------------------------------------}
myStartupHook = return()


{-------------------------------------------------------------------------------
	Management hooks. You can use management hooks to enforce certain behaviours
	when specific programs or windows are launched. This is useful if you want 
	certain windows to not be managed by xmonad, or sent to a specific 
	workspace, or otherwise handled in a special way.

	Each entry within the list of hooks defines a way to identify a	window 
	(before the arrow), and then how that window should be treated (after the 
	arrow).

	To figure out to identify your window, you will need to use a command-line 
	tool called "xprop". When you run xprop, your cursor will temporarily change
	to crosshairs; click on the window you want to identify. In the output that 
	is printed in your terminal, look for a couple of things:
		- WM_CLASS(STRING): values in this list of strings can be compared
	  	  to "className" to match windows.
		- WM_NAME(STRING): this value can be compared to "resource" to match
	      windows.

	The className values tend to be generic, and might match any window or 
	dialog owned by a particular program. The resource values tend to be more
	specific, and will be different for every dialog. Sometimes you might want 
	to compare both className and resource, to make sure you are matching only a
	particular window which belongs to a specific program.

	Once you've pinpointed the window you want to manipulate, here are a few 
	examples of things you might do with that window:
		- doIgnore: this tells xmonad to completely ignore the window. It will
	  	  not be tiled or floated. Useful for things like launchers and trays.
		- doFloat: this tells xmonad to float the window rather than tiling it.
	      Handy for things that pop up, take some input, and then go away, such
	      as dialogs, calculators, and so on.
	    - doF (W.shift "Workspace"): this tells xmonad that when this program is
		  is launched it should be sent to a specific workspace. Useful for
		  keeping specific tasks on specific workspaces. In the example below I
		  have specific workspaces for chat, development, and editing images.
-------------------------------------------------------------------------------}

myManageHook = composeAll [
    className =? "Chromium"               --> doShift "6:Web",
    className =? "Google-chrome"          --> doShift "6:Web",
    
    className =? "Eclipse"                --> doShift "5:Dev",
    
    className =? "Gimp"                   --> doF (W.shift "9:Pix"),
    className =? "MPlayer"                --> doFloat,
    resource  =? "skype"                  --> doFloat,
	className =? "rdesktop"               --> doFloat,
    
	className =? "Unity-2d-panel"         --> doFloat,
    className =? "Unity-2d-shell"         --> doIgnore,
    className =? "Unity-2d-launcher"      --> doFloat,
    
    isFullscreen                          --> (doF W.focusDown <+> doFullFloat)
    ]


{-------------------------------------------------------------------------------
	Here we actually stitch together all the configuration settings and run 
	xmonad. We also spawn an instance of xmobar and pipe content into it via the
	logHook..
-------------------------------------------------------------------------------}

{-------------------------------------------------------------------------------
-- Run xmonad with all the defaults we set up.
-------------------------------------------------------------------------------}
main = do
  xmproc <- spawnPipe "/usr/bin/xmobar ~/.xmonad/xmobar.hs"
  xmonad $ withUrgencyHook dzenUrgencyHook { args = ["-bg", "red", "-xs", "1"] } $ defaults {
      logHook =  dynamicLogWithPP $ xmobarPP {
            ppOutput = hPutStrLn xmproc
          , ppTitle = xmobarColor xmobarTitleColor "" . shorten 100
          , ppCurrent = xmobarColor xmobarCurrentWorkspaceColor ""
          , ppSep = "   "}
      , manageHook = manageDocks <+> myManageHook
      , startupHook = setWMName "LG3D" >> takeTopFocus
  }

{-------------------------------------------------------------------------------
    Combine it all together
    
    A structure containing your configuration settings, overriding fields in the
    default config. Any you don't override, will use the defaults defined in 
    xmonad/XMonad/Config.hs
    
    No need to modify this.
-------------------------------------------------------------------------------}
defaults = myBaseConfig {
    -- simple stuff
    terminal           = myTerminal,
    focusFollowsMouse  = myFocusFollowsMouse,
    borderWidth        = myBorderWidth,
    modMask            = myModMask,
    --numlockMask        = myNumlockMask,
    workspaces         = myWorkspaces,
    normalBorderColor  = myNormalBorderColor,
    focusedBorderColor = myFocusedBorderColor,

    -- Key bindings
    keys               = myKeys,
    mouseBindings      = myMouseBindings,

    -- Hooks, layouts
    layoutHook         = myWorkspaceLayouts,
    manageHook         = myManageHook,
    startupHook        = myStartupHook
}
