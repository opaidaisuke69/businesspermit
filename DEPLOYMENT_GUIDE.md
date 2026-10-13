# LCC BPA System - Deployment Guide

## 📋 Pre-Deployment Checklist

### 1. Backend (PHP API)

#### Environment Configuration
Update `bpa-backend/.env` for production:

```env
# Database Configuration
DB_HOST=your-production-db-host
DB_PORT=3306
DB_NAME=lcc_bpa_production
DB_USER=your-db-user
DB_PASS=your-secure-password

# JWT Secret (CHANGE THIS!)
JWT_SECRET=your-very-long-random-secret-key-here-min-32-chars

# Email Configuration (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@lacarlota.gov.ph
SMTP_FROM_NAME=LCC BPA System

# PayMongo Configuration
PAYMONGO_SECRET_KEY=sk_live_your_live_secret_key
PAYMONGO_PUBLIC_KEY=pk_live_your_live_public_key

# Application URL
APP_URL=https://yourdomain.com
FRONTEND_URL=https://admin.yourdomain.com
```

#### Security Updates
1. **Change JWT Secret**: Generate a strong random key
   ```bash
   # Generate random secret
   openssl rand -base64 32
   ```

2. **Update CORS Origins** in `bpa-backend/index.php`:
   ```php
   $allowedOrigins = [
       'https://yourdomain.com',
       'https://admin.yourdomain.com',
   ];
   ```

3. **Disable Debug Mode**: Remove or comment out error display
   ```php
   // Remove these in production
   // ini_set('display_errors', 1);
   // error_reporting(E_ALL);
   ```

4. **Update .htaccess** for production:
   ```apache
   # Add security headers
   Header set X-Content-Type-Options "nosniff"
   Header set X-Frame-Options "SAMEORIGIN"
   Header set X-XSS-Protection "1; mode=block"
   Header set Referrer-Policy "strict-origin-when-cross-origin"
   ```

#### Database Setup
1. **Create Production Database**:
   ```sql
   CREATE DATABASE lcc_bpa_production CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

2. **Run Schema**:
   ```bash
   mysql -u username -p lcc_bpa_production < bpa-database/schema.sql
   ```

3. **Run All Migrations** (in order):
   ```bash
   mysql -u username -p lcc_bpa_production < bpa-database/migration_v2.sql
   mysql -u username -p lcc_bpa_production < bpa-database/migration_v3.sql
   # ... continue with all migrations up to v14
   mysql -u username -p lcc_bpa_production < bpa-database/migration_v14_add_renewal.sql
   ```

4. **Create Admin User**:
   ```sql
   INSERT INTO admins (username, email, password, full_name, role, is_active) 
   VALUES ('admin', 'admin@lacarlota.gov.ph', '$2y$10$hashed_password', 'System Administrator', 'super_admin', 1);
   ```

5. **Set Timezone**:
   ```sql
   SET GLOBAL time_zone = '+08:00';
   ```

#### File Permissions
```bash
# Set proper permissions
chmod 755 bpa-backend/
chmod 644 bpa-backend/*.php
chmod 600 bpa-backend/.env
chmod 755 bpa-backend/uploads/
chmod 775 bpa-backend/uploads/  # Writable by web server
chmod 644 bpa-backend/uploads/*
```

#### Uploads Folder Setup
The `uploads/` folder stores user-uploaded documents (IDs, business permits, etc.).

**Important**:
1. **Create uploads folder** if it doesn't exist:
   ```bash
   mkdir -p bpa-backend/uploads
   ```

2. **Set proper ownership** (web server needs write access):
   ```bash
   # For Apache
   sudo chown -R www-data:www-data bpa-backend/uploads
   
   # For Nginx
   sudo chown -R nginx:nginx bpa-backend/uploads
   ```

3. **Set permissions**:
   ```bash
   chmod 775 bpa-backend/uploads
   ```

4. **Add .htaccess** to uploads folder for security:
   ```bash
   cat > bpa-backend/uploads/.htaccess << 'EOF'
   # Prevent PHP execution in uploads folder
   <FilesMatch "\.php$">
     Order Allow,Deny
     Deny from all
   </FilesMatch>
   
   # Allow only specific file types
   <FilesMatch "\.(jpg|jpeg|png|gif|pdf)$">
     Order Allow,Deny
     Allow from all
   </FilesMatch>
   EOF
   ```

5. **Configure max upload size** in `php.ini`:
   ```ini
   upload_max_filesize = 10M
   post_max_size = 10M
   max_file_uploads = 20
   ```

6. **Backup strategy** for uploads:
   ```bash
   # Daily backup of uploads
   tar -czf uploads_backup_$(date +%Y%m%d).tar.gz bpa-backend/uploads/
   ```

7. **Clean old test uploads** before going live:
   ```bash
   # Remove test uploads (be careful!)
   rm -f bpa-backend/uploads/upload_*
   ```

**Security Notes**:
- ✅ Uploads folder is writable by web server
- ✅ PHP execution is disabled in uploads
- ✅ Only image and PDF files are allowed
- ✅ Files are named with random hashes (not original names)
- ✅ Direct access to uploads is controlled

---

### 2. Web Admin Panel (React)

#### Environment Configuration
Update `bpa-web/.env`:

```env
VITE_API_URL=https://api.yourdomain.com/bpa-backend/api
```

#### Build for Production
```bash
cd bpa-web
npm install
npm run build
```

#### Deploy Build
1. Upload `dist/` folder contents to your web server
2. Configure web server (Apache/Nginx)

**Apache (.htaccess)**:
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

**Nginx**:
```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

---

### 3. Mobile App (React Native)

#### Environment Configuration
Update `bpa-mobile/.env`:

```env
EXPO_PUBLIC_API_URL=https://api.yourdomain.com/bpa-backend/api
```

#### Update App Configuration
Edit `bpa-mobile/app.json`:

```json
{
  "expo": {
    "name": "LCC BPA",
    "slug": "lcc-bpa",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "lccbpa",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/images/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#073B3A"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.lacarlota.bpa"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/android-icon-foreground.png",
        "backgroundColor": "#073B3A"
      },
      "package": "com.lacarlota.bpa",
      "permissions": [
        "android.permission.INTERNET",
        "android.permission.ACCESS_NETWORK_STATE"
      ]
    },
    "web": {
      "bundler": "metro",
      "output": "static",
      "favicon": "./assets/images/favicon.png"
    },
    "plugins": [
      "expo-router"
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

#### Build Mobile App

**For Android (APK)**:
```bash
cd bpa-mobile
eas build --platform android --profile production
```

**For iOS**:
```bash
eas build --platform ios --profile production
```

**Or build locally**:
```bash
# Android
npx expo run:android --variant release

# iOS
npx expo run:ios --configuration Release
```

---

## 🚀 Deployment Options

### Option 1: Shared Hosting (cPanel)

1. **Upload Backend**:
   - Upload `bpa-backend/` to `public_html/bpa-backend/`
   - Create database via cPanel
   - Import schema and migrations
   - Update `.env` with database credentials

2. **Upload Web Admin**:
   - Build: `npm run build`
   - Upload `dist/` contents to `public_html/admin/`

3. **Mobile App**:
   - Build APK and distribute via Google Play or direct download

### Option 2: VPS/Cloud Server (Recommended)

**Server Requirements**:
- Ubuntu 20.04+ or CentOS 7+
- PHP 8.0+
- MySQL 8.0+
- Apache/Nginx
- SSL Certificate (Let's Encrypt)

**Setup Steps**:

1. **Install LAMP Stack**:
```bash
sudo apt update
sudo apt install apache2 mysql-server php8.1 php8.1-mysql php8.1-curl php8.1-mbstring
```

2. **Configure Apache**:
```apache
<VirtualHost *:80>
    ServerName api.yourdomain.com
    DocumentRoot /var/www/bpa-backend
    
    <Directory /var/www/bpa-backend>
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>

<VirtualHost *:80>
    ServerName admin.yourdomain.com
    DocumentRoot /var/www/bpa-web
    
    <Directory /var/www/bpa-web>
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

3. **Install SSL**:
```bash
sudo apt install certbot python3-certbot-apache
sudo certbot --apache -d api.yourdomain.com -d admin.yourdomain.com
```

4. **Deploy Files**:
```bash
# Backend
sudo cp -r bpa-backend /var/www/
sudo chown -R www-data:www-data /var/www/bpa-backend

# Web Admin
sudo cp -r bpa-web/dist /var/www/bpa-web
sudo chown -R www-data:www-data /var/www/bpa-web
```

### Option 3: Docker (Advanced)

Create `docker-compose.yml`:
```yaml
version: '3.8'
services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: lcc_bpa
    volumes:
      - mysql_data:/var/lib/mysql
      - ./bpa-database:/docker-entrypoint-initdb.d
    
  backend:
    image: php:8.1-apache
    volumes:
      - ./bpa-backend:/var/www/html
    ports:
      - "8080:80"
    depends_on:
      - mysql
      
  web:
    image: nginx:alpine
    volumes:
      - ./bpa-web/dist:/usr/share/nginx/html
    ports:
      - "3000:80"

volumes:
  mysql_data:
```

---

## 🔒 Security Checklist

- [ ] Change all default passwords
- [ ] Generate new JWT secret
- [ ] Enable HTTPS/SSL
- [ ] Update CORS origins
- [ ] Disable debug mode
- [ ] Set proper file permissions
- [ ] Enable firewall
- [ ] Regular backups
- [ ] Update PayMongo to live keys
- [ ] Configure email SMTP
- [ ] Test all payment flows
- [ ] Review error logs

---

## 📱 Mobile App Distribution

### Google Play Store
1. Create developer account
2. Build signed APK/AAB
3. Upload to Play Console
4. Fill app details and screenshots
5. Submit for review

### Direct Distribution
1. Build APK
2. Host on your server
3. Share download link
4. Users enable "Install from Unknown Sources"

---

## 🔄 Post-Deployment

### 1. Test Everything
- [ ] Admin login
- [ ] User registration
- [ ] Email verification
- [ ] Application submission
- [ ] Payment processing (test mode first!)
- [ ] Permit generation
- [ ] Permit renewal
- [ ] Notifications
- [ ] Map functionality
- [ ] Reports generation

### 2. Monitor
- Check error logs daily
- Monitor database size
- Track API response times
- Review user feedback

### 3. Backup Strategy
```bash
# Daily database backup
mysqldump -u username -p lcc_bpa_production > backup_$(date +%Y%m%d).sql

# Weekly full backup
tar -czf backup_$(date +%Y%m%d).tar.gz /var/www/bpa-backend /var/www/bpa-web
```

---

## 🆘 Troubleshooting

### Common Issues

**1. CORS Errors**
- Check allowed origins in `bpa-backend/index.php`
- Verify API URL in frontend `.env`

**2. Database Connection Failed**
- Verify credentials in `.env`
- Check MySQL is running
- Test connection: `mysql -u user -p -h host`

**3. Payments Not Working**
- Verify PayMongo keys (live vs test)
- Check webhook configuration
- Review PayMongo dashboard logs

**4. Emails Not Sending**
- Verify SMTP credentials
- Check spam folder
- Test with: `php -r "mail('test@example.com', 'Test', 'Body');"`

**5. Mobile App Can't Connect**
- Verify API URL in `.env`
- Check SSL certificate
- Test API: `curl https://api.yourdomain.com/bpa-backend/api/health`

---

## 📞 Support

For deployment assistance:
- Review logs: `tail -f /var/log/apache2/error.log`
- Check PHP errors: `tail -f /var/www/bpa-backend/error.log`
- Database logs: `tail -f /var/log/mysql/error.log`

---

## 🎉 Go Live!

Once everything is tested and working:
1. Announce to users
2. Provide training materials
3. Monitor closely for first week
4. Gather feedback
5. Plan updates

**Congratulations on deploying the LCC BPA System!** 🚀
