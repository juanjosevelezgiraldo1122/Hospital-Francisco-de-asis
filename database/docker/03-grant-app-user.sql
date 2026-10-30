-- Reapply app permissions after the reset schema recreates its database.
GRANT ALL PRIVILEGES ON hospital_francisco_asis.* TO 'hospital_app'@'%';
