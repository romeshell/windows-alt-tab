const Gio = imports.gi.Gio;

function getSettings(metadata, extension_id) {
    let schemaDir = metadata.dir.get_path();
    let schemaSource = Gio.SettingsSchemaSource.new_from_directory(schemaDir,
								  Gio.SettingsSchemaSource.get_default(),
								  false);
    let schema = schemaSource.lookup('org.gnome.shell.extensions.' + extension_id, false);
    return new Gio.Settings({ settings_schema: schema });
}
								  
