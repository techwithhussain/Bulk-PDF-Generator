import sqlite3

db_path = r'C:\Users\HUSSAIN\AppData\Roaming\local-pdf-studio\studio.db'
db = sqlite3.connect(db_path)

db.execute("DELETE FROM app_settings WHERE key IN ('license_status','license_key','license_activated_at','license_user')")
db.commit()

rows = db.execute("SELECT key, value FROM app_settings WHERE key LIKE 'license%'").fetchall()
print('License entries after clear:', rows)
print('Done! Ab app restart karo.')
db.close()

