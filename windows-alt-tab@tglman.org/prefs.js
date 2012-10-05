const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const Gdk = imports.gi.Gdk;
const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;

const SETTINGS_SCHEMA = 'windows-alt-tab';

let extension = imports.misc.extensionUtils.getCurrentExtension();
let convenience = extension.imports.convenience;

let Schema;

function init() {
    //convenience.initTranslations(extension);
    Schema = convenience.getSettings(extension, SETTINGS_SCHEMA);
}


const App = new Lang.Class({
	Name: 'WindowsAltTab.App',
	_init : function () {
		this.main_vbox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL,
                                       spacing: 10,
                                       border_width: 10});
                                       
        this.label = new Gtk.Label({label: "Selected Window Display:"});
        this.selector = new Gtk.ComboBoxText();
        this.selector.append_text("None");
        this.selector.append_text("Bring To Front");
        this.selector.set_active(Schema.get_enum("preview-mode"));
        this.selector.connect('changed', function(owner){
	        	Schema.set_enum("preview-mode", owner.get_active() );
            });
        this.actor = new Gtk.HBox();
        this.actor.add(this.label);
        this.actor.add(this.selector);
        this.main_vbox.add(this.actor);        
        this.labelIcon = new Gtk.Label({label: "List thumb:"});
        this.selectorIcon = new Gtk.ComboBoxText();
        this.selectorIcon.append_text("Icon");
        this.selectorIcon.append_text("Preview");
        this.selectorIcon.set_active(Schema.get_enum("icon-mode"));
        this.selectorIcon.connect('changed', function(owner){
	        	Schema.set_enum("icon-mode", owner.get_active() );
	         });
        this.actorIcon = new Gtk.HBox();
        this.actorIcon.add(this.labelIcon);
        this.actorIcon.add(this.selectorIcon);
        
        this.sizelabel = new Gtk.Label({label: "Window Size:"});
        this.sizespin = new Gtk.SpinButton();
        this.sizeactor = new Gtk.HBox();
        this.sizeactor.add(this.sizelabel);
        this.sizeactor.add(this.sizespin);
        this.sizespin.set_numeric(true);
        this.sizespin.set_range(0, 1000);
        this.sizespin.set_increments(1, -1);
        Schema.bind("window-size", this.sizespin, 'value', Gio.SettingsBindFlags.DEFAULT);

        this.workspace = new Gtk.CheckButton({label: "Workspace navigation"});
        this.workspace.connect('toggled', function(owner){
                        Schema.set_boolean("workspace-navigation", owner.get_active() );
            });

        this.main_vbox.add(this.actorIcon);
        this.main_vbox.add(this.sizeactor);
        this.main_vbox.add(this.workspace);
        this.main_vbox.show_all();
	}
});

function buildPrefsWidget(){
    let widget = new App();
    return widget.main_vbox;
};
