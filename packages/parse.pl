#!/usr/bin/env perl

use strict;
use warnings;

use Getopt::Std;
use Getopt::Long;

################################################################################

use constant {
    CLI_PACKAGE_FILE => "packages.cli",
    GUI_PACKAGE_FILE => "packages.gui"
};

use constant {
    false   =>  0,
    true    =>  1
};

# Forward declarations
sub trim($);
sub ltrim($);
sub rtrim($);

################################################################################

my $package_file = GUI_PACKAGE_FILE;
my %all_packages = ();

# Get command line options
Getopt::Long::Configure('bundling');
my $all_data;
GetOptions('a|all-data' => \$all_data);

# The argument should be the input file
open FILE, "<", $package_file or die $!;

# Parse the data
my $line;
my $header;
while($line = <FILE>) {
    chomp($line); # remove newline characters
    
    if ($line =~ m/^\s*#/) {
        # This is a header and/or a comment
        
        if ($line =~ m/\$.*\$/) {
            ($header = $line) =~ s/\s*#\s*\$(.*)\$/$1/;
            $all_packages{$header} = ();
            $all_packages{$header}{'comment'} = '';
            $all_packages{$header}{'packages'} = [];
        }
        
        (my $comment = $line) =~ s/\$.*\$//;
        $comment =~ s/^[^#]*(#\s*)?//;
        if ($comment !~ m/^$/) {
            $all_packages{$header} = $comment;
        }
    } else {
        # This is data
        (my $package = $line) =~ s/\s*#.*$//;
        (my $comment = $line) =~ s/^[^#]*(#\s*)?//;
        
        $all_packages{$header}{'packages'} = 
        
        print "Package: '$package'\n";
        print "Comment: '$comment'\n";
    }
}

# Perl trim function to remove whitespace from the start and end of the string
sub trim($) {
    my $string = shift;
    $string =~ s/^\s+//;
    $string =~ s/\s+$//;
    return $string;
}

# Left trim function to remove leading whitespace
sub ltrim($) {
    my $string = shift;
    $string =~ s/^\s+//;
    return $string;
}

# Right trim function to remove trailing whitespace
sub rtrim($) {
    my $string = shift;
    $string =~ s/\s+$//;
    return $string;
}
