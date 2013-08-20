const Main = imports.ui.main;
const Meta = imports.gi.Meta;

const AltTab = imports.ui.altTab;
const Clutter = imports.gi.Clutter;
const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const ModalDialog = imports.ui.modalDialog;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Tweener = imports.ui.tweener;
const WindowManager = imports.ui.windowManager;

const SETTINGS_SCHEMA = 'windows-alt-tab';

let extension = imports.misc.extensionUtils.getCurrentExtension();
let convenience = extension.imports.convenience;
let Schema;

const POPUP_FADE_TIME = 0.0; // seconds

const AltTabPopupW = new Lang.Class({
    Name: 'AltTabPopupW',
    Extends: AltTab.AltTabPopup,

    _init: function(index) {
       this._index = index;
       this._modifierMask=0;
       this.parent();
    },

    show : function(backward, binding, mask) {
        let appSys = Shell.AppSystem.get_default();
        let apps = appSys.get_running ();

        if (!apps.length)
            return false;

        if (!Main.pushModal(this.actor))
            return false;
        this._haveModal = true;
	this._modifierMask = AltTab.primaryModifier(mask);

        this.actor.connect('key-press-event', Lang.bind(this, this._keyPressEvent));
        this.actor.connect('key-release-event', Lang.bind(this, this._keyReleaseEvent));

        this.actor.connect('button-press-event', Lang.bind(this, this._clickedOutside));
        this.actor.connect('scroll-event', Lang.bind(this, this._onScroll));

        this._appSwitcher = new WindowSwitcher(apps, this, this._index);
        this.actor.add_actor(this._appSwitcher.actor);
        this._appSwitcher.connect('item-activated', Lang.bind(this, this._finish));
        this._appSwitcher.connect('item-entered', Lang.bind(this, this._appEntered));

        this._appIcons = this._appSwitcher.icons;

        // Make the initial selection
        if (this._appIcons.length == 1) {
            this._select(0);
        } else if (backward) {
            this._select(this._appIcons.length - 1);
        } else {
            if (this._appIcons.length > 0 && this._index == 0) {
                this._select(1);
            } else if(this._appIcons.length > 0)
		this._select(0);
        }

        let [x, y, mods] = global.get_pointer();
        if (!(mods & this._modifierMask)) {
            this._finish();
            return false;
        }

        this.actor.opacity = 0;
        this.actor.show();
	
        Tweener.addTween(this.actor,
                         { opacity: 255,
                           time: POPUP_FADE_TIME,
                           transition: 'easeOutQuad'
                         });
        return true;
    },
    
    
    _keyPressEvent : function(actor, event) {
        let keysym = event.get_key_symbol();
        let event_state = event.get_state();
        let backwards = event_state & Clutter.ModifierType.SHIFT_MASK;
        let action = global.display.get_keybinding_action(event.get_key_code(), event_state);

        this._disableHover();

        if(action == Meta.KeyBindingAction.WORKSPACE_LEFT) {
            this.destroy();
            this.actionMoveWorkspaceLeft();
            new AltTabPopupW(0).show(backwards,"",event_state);
        } else if(action == Meta.KeyBindingAction.WORKSPACE_RIGHT) {
            this.destroy();
            this.actionMoveWorkspaceRight();
            new AltTabPopupW(0).show(backwards,"",event_state);
        } else if(action == Meta.KeyBindingAction.WORKSPACE_DOWN) {
            this.destroy();
            this.actionMoveWorkspaceDown();
            new AltTabPopupW(0).show(backwards,"",event_state);
        } else if(action == Meta.KeyBindingAction.WORKSPACE_UP) {
            this.destroy();
            this.actionMoveWorkspaceUp();
            new AltTabPopupW(0).show(backwards,"",event_state);
        } else if (keysym == Clutter.Escape) {
            this.destroy();
        } else if (action == Meta.KeyBindingAction.SWITCH_GROUP) {
            this._select(this._currentApp, backwards ? this._previousWindow() : this._nextWindow());
        } else if (action == Meta.KeyBindingAction.SWITCH_GROUP_BACKWARD) {
            this._select(this._currentApp, this._previousWindow());
        } else if (action == Meta.KeyBindingAction.SWITCH_WINDOWS) {
            this._select(backwards ? this._previousApp() : this._nextApp());
        } else if (action == Meta.KeyBindingAction.SWITCH_WINDOWS_BACKWARD) {
            this._select(this._previousApp());
        } else if (this._thumbnailsFocused) {
            if (keysym == Clutter.Left)
                this._select(this._currentApp, this._previousWindow());
            else if (keysym == Clutter.Right)
                this._select(this._currentApp, this._nextWindow());
            else if (keysym == Clutter.Up)
                this._select(this._currentApp, null, true);
        } else {
            if (keysym == Clutter.Left)
                this._select(this._previousApp());
            else if (keysym == Clutter.Right)
                this._select(this._nextApp());
            else if (keysym == Clutter.Down && !Schema.get_boolean("workspace-navigation"))
                this._select(this._currentApp, 0);
            else if (Schema.get_boolean("workspace-navigation")) {
                if (keysym == Clutter.Up) {
                    let idx = this._index - 1;
                    if (global.screen.get_active_workspace_index() + idx >= 0) {
                        this.destroy();
                        new AltTabPopupW(idx).show(backwards,"",event_state);
                    }
                } else if (keysym == Clutter.Down) {
                    let idx = this._index + 1;
                    if (global.screen.get_active_workspace_index() + idx + 1 < global.screen.n_workspaces) {
                        this.destroy();
                        new AltTabPopupW(idx).show(backwards,"",event_state);
                    }
                }
            }
        }

        return true;
    },

    destroy : function() {
	if(this._appSwitcher.previewActor)
	{
		this._appSwitcher.previewActor.destroy();
		this._appSwitcher.previewActor=undefined;
	}
	AltTab.AltTabPopup.prototype.destroy.call(this);
    },

    _keyReleaseEvent : function(actor, event) {
        let [x, y, mods] = global.get_pointer();
        let state = mods & this._modifierMask;
	if (state == 0)
		 this._finish();

        return true;
    },

    _finish : function() {
        let app = this._appIcons[this._currentApp];
        if (app) {
            Main.activateWindow(app.cachedWindows[0]);
        }
        this.destroy();
    },

    actionMoveWorkspaceLeft: function() {
        let rtl = (Clutter.get_default_text_direction() == Clutter.TextDirection.RTL);
        let activeWorkspaceIndex = global.screen.get_active_workspace_index();
        let indexToActivate = activeWorkspaceIndex;
        if (rtl && activeWorkspaceIndex < global.screen.n_workspaces - 1)
            indexToActivate++;
        else if (!rtl && activeWorkspaceIndex > 0)
            indexToActivate--;

        if (indexToActivate != activeWorkspaceIndex)
            global.screen.get_workspace_by_index(indexToActivate).activate(global.get_current_time());
    },

    actionMoveWorkspaceRight: function() {
        let rtl = (Clutter.get_default_text_direction() == Clutter.TextDirection.RTL);
        let activeWorkspaceIndex = global.screen.get_active_workspace_index();
        let indexToActivate = activeWorkspaceIndex;
        if (rtl && activeWorkspaceIndex > 0)
            indexToActivate--;
        else if (!rtl && activeWorkspaceIndex < global.screen.n_workspaces - 1)
            indexToActivate++;

        if (indexToActivate != activeWorkspaceIndex)
            global.screen.get_workspace_by_index(indexToActivate).activate(global.get_current_time());
    },

    actionMoveWorkspaceUp: function() {
        let activeWorkspaceIndex = global.screen.get_active_workspace_index();
        let indexToActivate = activeWorkspaceIndex;
        if (activeWorkspaceIndex > 0)
            indexToActivate--;

        if (indexToActivate != activeWorkspaceIndex)
            global.screen.get_workspace_by_index(indexToActivate).activate(global.get_current_time());
    },

    actionMoveWorkspaceDown: function() {
        let activeWorkspaceIndex = global.screen.get_active_workspace_index();
        let indexToActivate = activeWorkspaceIndex;
        if (activeWorkspaceIndex < global.screen.n_workspaces - 1)
            indexToActivate++;

        if (indexToActivate != activeWorkspaceIndex)
            global.screen.get_workspace_by_index(indexToActivate).activate(global.get_current_time());
    }
});

function AppIcon(app, window) {
    this._init(app, window);
}
        
AppIcon.prototype = {
    __proto__ : AltTab.AppIcon.prototype,

    _init: function(app, window) {
        this.app = app;

        this.cachedWindows = [];
        this.cachedWindows.push(window);

        this.actor = new St.BoxLayout({ style_class: 'alt-tab-app',
                                         vertical: true });
        this.icon = null;
        this._iconBin = new St.Bin({ x_fill: false, y_fill: false });

        this.actor.add(this._iconBin, { x_fill: false, y_fill: false } );

        let title = window.get_title();
        if (title) {
            this.label = new St.Label({ text: title });
            let bin = new St.Bin({ x_align: St.Align.MIDDLE });
            bin.add_actor(this.label);
            this.actor.add(bin);
        }
        else {
            this.label = new St.Label({ text: this.app.get_name() });
            this.actor.add(this.label, { x_fill: false });
        }
    },
    
    set_size: function(size) {
        if(Schema.get_enum("icon-mode") == 0) {
	        this.icon = this.app.create_icon_texture(size);
        } else {
	        let mutterWindow = this.cachedWindows[0].get_compositor_private();
		if (!mutterWindow)
                	return;
		let windowTexture = mutterWindow.get_texture ();
		let [width, height] = windowTexture.get_size();
		let scale = Math.min(1.0, size / width, size / height);
		this.icon = new Clutter.Clone ({ source: windowTexture,
                                                reactive: true,
                                                width: width * scale,
                                                height: height * scale });
             
        }
        this._iconBin.set_size(size, size);
        this._iconBin.child = this.icon;
    }

};

function WindowSwitcher(apps, altTabPopup, index) {
    this._init(apps, altTabPopup, index);
}

WindowSwitcher.prototype = {
    __proto__ : AltTab.AppSwitcher.prototype,

    _init : function(apps, altTabPopup, index) {
        AltTab.SwitcherList.prototype._init.call(this, true);

        this._index = global.screen.get_active_workspace_index() + index;

        let activeWorkspace = global.screen.get_workspace_by_index(this._index);
        let workspaceIcons = [];
        for (let i = 0; i < apps.length; i++) {
            let windows = apps[i].get_windows();
            for(let j = 0; j < windows.length; j++) {
                let appIcon = new AppIcon(apps[i], windows[j]);
                if (this._isWindowOnWorkspace(windows[j], activeWorkspace)) {
                  workspaceIcons.push(appIcon);
                }
            }
        }

        workspaceIcons.sort(Lang.bind(this, this._sortAppIcon));

        this.icons = [];
        this._arrows = [];
        for (let i = 0; i < workspaceIcons.length; i++)
            this._addIcon(workspaceIcons[i]);

        this._curApp = -1;
        this._iconSize = 0;
        this._altTabPopup = altTabPopup;
        this._mouseTimeOutId = 0;
    },

    highlight: function(index, justOutline) {
        if (!this._items[index]) {
            return;
        }

        if (this._highlighted != -1) {
            this._items[this._highlighted].remove_style_pseudo_class('outlined');
            this._items[this._highlighted].remove_style_pseudo_class('selected');
        }

        this._highlighted = index;

        if (this._highlighted != -1) {
            if (justOutline)
                this._items[this._highlighted].add_style_pseudo_class('outlined');
            else
                this._items[this._highlighted].add_style_pseudo_class('selected');
        }

        let [absItemX, absItemY] = this._items[index].get_transformed_position();
        let [result, posX, posY] = this.actor.transform_stage_point(absItemX, 0);
        let [containerWidth, containerHeight] = this.actor.get_transformed_size();
        
        if (posX + this._items[index].get_width() > containerWidth)
            this._scrollToRight();
        else if (absItemX < 0)
            this._scrollToLeft();
        if(Schema.get_enum("preview-mode") == 1) {
        	let app = this.icons[index];
		if(this.previewActor) {
			this.previewActor.destroy();
			this.previewActor=undefined;
		}
		let mutterWindow = app.cachedWindows[0].get_compositor_private();
		if (!mutterWindow)
		return;
		let windowTexture = mutterWindow.get_texture (); 
		let [width, height] = windowTexture.get_size();
		let [posX, posY] = windowTexture.get_transformed_position();
		var preview = new Clutter.Clone ({ source: windowTexture,
						reactive: true,
						width: width,
						height: height}); 
		this.previewActor = new St.Widget({name:'altTabWindowPreview',x:posX,y:posY,width:width,height:height,reactive:false});
		this.previewActor.add_actor(preview);
		
		Main.uiGroup.add_actor(this.previewActor);
		this._altTabPopup.actor.raise_top();
        }
    },

    _isWindowOnWorkspace: function(w, workspace) {
            if (w.get_workspace() == workspace)
                return true;
        return false;
    },

    _sortAppIcon : function(appIcon1, appIcon2) {
        let t1 = appIcon1.cachedWindows[0].get_user_time();
        let t2 = appIcon2.cachedWindows[0].get_user_time();
        if (t2 > t1) return 1;
        else return -1;
    },
    
    _getPreferredHeight: function (actor, forWidth, alloc) {
        let j = 0;
        while(this._items.length > 1 && this._items[j].style_class != 'item-box') {
                j++;
        }
	if(!this._items[j])return;
        let themeNode = this._items[j].get_theme_node();
        let iconPadding = themeNode.get_horizontal_padding();
        let iconBorder = themeNode.get_border_width(St.Side.LEFT) + themeNode.get_border_width(St.Side.RIGHT);
        let [iconMinHeight, iconNaturalHeight] = this.icons[j].label.get_preferred_height(-1);
        let iconSpacing = iconNaturalHeight + iconPadding + iconBorder;
        let totalSpacing = this._list.spacing * (this._items.length - 1);
        if (this._separator)
           totalSpacing += this._separator.width + this._list.spacing;

        // We just assume the whole screen here due to weirdness happing with the passed width
        let primary = Main.layoutManager.primaryMonitor;
        let parentPadding = this.actor.get_parent().get_theme_node().get_horizontal_padding();
        let availWidth = primary.width - parentPadding - this.actor.get_theme_node().get_horizontal_padding();
        let height = 0;
		let iconSizes =AltTab.iconSizes;
        if(Schema.get_enum("icon-mode") == 1) {
        	iconSizes =[Schema.get_int("window-size")];
        }
        for(let i =  0; i < iconSizes.length; i++) {
                this._iconSize = iconSizes[i];
                height = iconSizes[i] + iconSpacing;
                let w = height * this._items.length + totalSpacing;
                if (w <= availWidth)
                        break;
        }

        if (this._items.length == 1) {
            this._iconSize = iconSizes[0];
            height = iconSizes[0] + iconSpacing;
        }

        for(let i = 0; i < this.icons.length; i++) {
            if (this.icons[i].icon != null)
                break;
            this.icons[i].set_size(this._iconSize);
        }

        alloc.min_size = height;
        alloc.natural_size = height;
    },
    
};

function init(metadata) {
    Schema = convenience.getSettings(extension, SETTINGS_SCHEMA);
}

function doAltTab(display, screen, window, binding) {
    let modifiers = binding.get_modifiers()
    let backwards = modifiers & Meta.VirtualModifier.SHIFT_MASK;
    new AltTabPopupW(0).show(backwards, binding.get_name(), binding.get_mask());
}

function enable() {
    Meta.keybindings_set_custom_handler('switch-windows', doAltTab);
    Meta.keybindings_set_custom_handler('switch-group', doAltTab);
    Meta.keybindings_set_custom_handler('switch-windows-backward', doAltTab);
    Meta.keybindings_set_custom_handler('switch-group-backward', doAltTab);
}

function disable() {
    Meta.keybindings_set_custom_handler('switch-windows',Lang.bind(Main.wm, Main.wm._startAppSwitcher));
    Meta.keybindings_set_custom_handler('switch-group',Lang.bind(Main.wm, Main.wm._startAppSwitcher));
    Meta.keybindings_set_custom_handler('switch-windows-backward',Lang.bind(Main.wm, Main.wm._startAppSwitcher));
    Meta.keybindings_set_custom_handler('switch-group-backward',Lang.bind(Main.wm, Main.wm._startAppSwitcher));
}
